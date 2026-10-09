import { act, renderHook } from '@testing-library/react';
import html2canvas from 'html2canvas';
import { usePrintBooking } from '@/hooks/usePrintBooking';
import type { PopulatedBooking } from '@/types';
import { addToast } from '@heroui/toast';
const mockSave = jest.fn();
jest.mock('html2canvas', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('jspdf', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    addImage: jest.fn(),
    save: mockSave,
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
  })),
}));
const booking: PopulatedBooking = {
  _id: 'booking',
  id: 'booking',
  guest: null,
  cabin: null,
  customer: null,
  checkInDate: '2040-01-01',
  checkOutDate: '2040-01-02',
  numNights: 1,
  numGuests: 1,
  status: 'confirmed',
  cabinPrice: 10,
  extrasPrice: 0,
  totalPrice: 10,
  depositAmount: 0,
  amountPaid: 0,
  remainingAmount: 10,
  isPaid: false,
  depositPaid: false,
};
beforeEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = '<div id="booking-pdf-template">Booking</div>';
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
test('PDF failure rejects, clears busy state and permits a retry with the same filename', async () => {
  jest.mocked(html2canvas).mockRejectedValueOnce(new Error('Canvas failed'));
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  jest
    .spyOn(canvas, 'toDataURL')
    .mockReturnValue('data:image/png;base64,image');
  jest.mocked(html2canvas).mockResolvedValueOnce(canvas);
  const { result } = renderHook(() => usePrintBooking(booking));
  await act(async () => {
    await expect(
      result.current.handleDownloadPDF('booking-pdf-template')
    ).rejects.toThrow('Canvas failed');
  });
  expect(result.current.isGeneratingPDF).toBe(false);
  expect(addToast).toHaveBeenCalledWith(
    expect.objectContaining({
      description: 'Failed to generate PDF: Canvas failed',
    })
  );
  await act(async () => {
    await result.current.handleDownloadPDF('booking-pdf-template', {
      filename: 'receipt.pdf',
    });
  });
  expect(mockSave).toHaveBeenCalledWith('receipt.pdf');
});
test('a pending PDF excludes duplicate PDF, popup print and browser print until it completes', async () => {
  let finish: (canvas: HTMLCanvasElement) => void = () => {
    throw new Error('not started');
  };
  jest.mocked(html2canvas).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const browserPrint = jest.spyOn(window, 'print').mockImplementation(() => {});
  const open = jest.spyOn(window, 'open').mockReturnValue(null);
  const { result } = renderHook(() => usePrintBooking(booking));
  let pending: Promise<void> = Promise.resolve();
  act(() => {
    pending = result.current.handleDownloadPDF('booking-pdf-template');
  });
  expect(result.current.isGeneratingPDF).toBe(true);
  expect(result.current.isPrinting).toBe(false);
  await act(async () => {
    await expect(
      result.current.handleDownloadPDF('booking-pdf-template')
    ).rejects.toThrow(/in progress/);
    await expect(
      result.current.handlePrint('booking-pdf-template')
    ).rejects.toThrow(/in progress/);
    result.current.handleBrowserPrint();
  });
  expect(html2canvas).toHaveBeenCalledTimes(1);
  expect(open).not.toHaveBeenCalled();
  expect(browserPrint).not.toHaveBeenCalled();
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  jest
    .spyOn(canvas, 'toDataURL')
    .mockReturnValue('data:image/png;base64,image');
  await act(async () => {
    finish(canvas);
    await pending;
  });
  expect(result.current.isGeneratingPDF).toBe(false);
  act(() => result.current.handleBrowserPrint());
  expect(browserPrint).toHaveBeenCalledTimes(1);
});
test('popup failures release the print operation for retry', async () => {
  jest.spyOn(window, 'open').mockReturnValue(null);
  const { result } = renderHook(() => usePrintBooking(booking));
  await act(async () => {
    await expect(
      result.current.handlePrint('booking-pdf-template')
    ).rejects.toThrow('Unable to open print window');
  });
  expect(result.current.isPrinting).toBe(false);
  await act(async () => {
    await expect(result.current.handlePrint('missing')).rejects.toThrow(
      'not found'
    );
  });
  expect(result.current.isPrinting).toBe(false);
});
test('popup printing remains busy until load and print complete, then permits another operation', async () => {
  jest.useFakeTimers();
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  const popup = frame.contentWindow;
  if (!popup) throw new Error('Missing popup window');
  jest.spyOn(window, 'open').mockReturnValue(popup);
  const print = jest.spyOn(popup, 'print').mockImplementation(() => {});
  const close = jest.spyOn(popup, 'close').mockImplementation(() => {});
  jest.spyOn(popup.document, 'write').mockImplementation(() => {});
  jest.spyOn(popup.document, 'close').mockImplementation(() => {});
  const { result } = renderHook(() => usePrintBooking(booking));
  let pending = Promise.resolve();
  act(() => {
    pending = result.current.handlePrint('booking-pdf-template');
  });
  expect(result.current.isPrinting).toBe(true);
  await act(async () => {
    await expect(
      result.current.handleDownloadPDF('booking-pdf-template')
    ).rejects.toThrow(/in progress/);
  });
  act(() => {
    popup.dispatchEvent(new Event('load'));
  });
  expect(result.current.isPrinting).toBe(true);
  await act(async () => {
    jest.advanceTimersByTime(500);
    await pending;
  });
  expect(print).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
  expect(result.current.isPrinting).toBe(false);
  jest.useRealTimers();
});

test.each([true, false])(
  'pre-load popup closure settles and permits PDF retry (pagehide=%p)',
  async emitPagehide => {
    jest.useFakeTimers();
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const popup = frame.contentWindow;
    if (!popup) throw new Error('Missing popup window');
    jest.spyOn(window, 'open').mockReturnValue(popup);
    const print = jest.spyOn(popup, 'print').mockImplementation(() => {});
    jest.spyOn(popup.document, 'write').mockImplementation(() => {});
    jest.spyOn(popup.document, 'close').mockImplementation(() => {});
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    jest
      .spyOn(canvas, 'toDataURL')
      .mockReturnValue('data:image/png;base64,image');
    jest.mocked(html2canvas).mockResolvedValue(canvas);
    const { result } = renderHook(() => usePrintBooking(booking));
    let settled = false;
    act(() => {
      void result.current.handlePrint('booking-pdf-template').then(() => {
        settled = true;
      });
    });
    expect(result.current.isPrinting).toBe(true);
    await act(async () => {
      Object.defineProperty(popup, 'closed', {
        configurable: true,
        value: true,
      });
      if (emitPagehide) popup.dispatchEvent(new Event('pagehide'));
      jest.advanceTimersByTime(1000);
    });
    expect(settled).toBe(true);
    expect(result.current.isPrinting).toBe(false);
    expect(print).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    await act(async () => {
      await result.current.handleDownloadPDF('booking-pdf-template', {
        filename: 'retry.pdf',
      });
    });
    expect(mockSave).toHaveBeenCalledWith('retry.pdf');
    expect(result.current.isGeneratingPDF).toBe(false);
  }
);
