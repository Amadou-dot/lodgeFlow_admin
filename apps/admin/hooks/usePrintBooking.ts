import type { PopulatedBooking } from '@/types';
import { addToast } from '@heroui/toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useCallback, useRef, useState } from 'react';

interface UsePrintBookingOptions {
  filename?: string;
  paperFormat?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
}

interface UsePrintBookingReturn {
  isPrinting: boolean;
  isGeneratingPDF: boolean;
  handlePrint: (elementId: string) => Promise<void>;
  handleDownloadPDF: (
    elementId: string,
    options?: UsePrintBookingOptions
  ) => Promise<void>;
  handleBrowserPrint: () => void;
}

export const usePrintBooking = (
  booking: PopulatedBooking
): UsePrintBookingReturn => {
  type Operation = 'idle' | 'printing' | 'pdf';
  const [operation, setOperation] = useState<Operation>('idle');
  const activeOperation = useRef<Operation>('idle');
  const begin = useCallback((next: Exclude<Operation, 'idle'>) => {
    if (activeOperation.current !== 'idle')
      throw new Error('Another print or PDF operation is already in progress');
    activeOperation.current = next;
    setOperation(next);
  }, []);
  const finish = useCallback(() => {
    activeOperation.current = 'idle';
    setOperation('idle');
  }, []);

  // Generate PDF filename
  const generateFilename = useCallback(
    (customFilename?: string) => {
      if (customFilename) return customFilename;

      const bookingId = booking._id.toString().slice(-8).toUpperCase();
      const guestName =
        `${booking.customer?.first_name ?? 'Unknown'}-${booking.customer?.last_name ?? 'Guest'}`.replace(
          /\s+/g,
          '-'
        );
      const date = new Date().toISOString().split('T')[0];

      return `booking-${bookingId}-${guestName}-${date}.pdf`;
    },
    [booking]
  );

  // Browser print functionality
  const handleBrowserPrint = useCallback(() => {
    if (activeOperation.current !== 'idle') return;
    begin('printing');
    try {
      window.print();
    } finally {
      finish();
    }
  }, [begin, finish]);

  // HTML element to canvas and then to PDF
  const handleDownloadPDF = useCallback(
    async (elementId: string, options: UsePrintBookingOptions = {}) => {
      begin('pdf');
      try {
        const element = document.getElementById(elementId);
        if (!element) {
          throw new Error(`Element with id "${elementId}" not found`);
        }

        // Configure html2canvas options for better quality
        const canvas = await html2canvas(element, {
          scale: 2, // Higher scale for better quality
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          removeContainer: true,
          imageTimeout: 15000,
          logging: false,
        });

        // Configure PDF settings
        const { paperFormat = 'a4', orientation = 'portrait' } = options;

        const pdf = new jsPDF({
          orientation,
          unit: 'mm',
          format: paperFormat,
        });

        // Calculate dimensions
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10; // 10mm margin
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;

        // Calculate scaling to fit page
        const canvasAspectRatio = canvas.height / canvas.width;
        let imgWidth = maxWidth;
        let imgHeight = imgWidth * canvasAspectRatio;

        // If height exceeds page, scale down
        if (imgHeight > maxHeight) {
          imgHeight = maxHeight;
          imgWidth = imgHeight / canvasAspectRatio;
        }

        // Center the image on the page
        const xOffset = (pageWidth - imgWidth) / 2;
        const yOffset = (pageHeight - imgHeight) / 2;

        // Convert canvas to image and add to PDF
        const imgData = canvas.toDataURL('image/png', 1.0);
        pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);

        // Generate filename and download
        const filename = generateFilename(options.filename);
        pdf.save(filename);
      } catch (error) {
        addToast({
          color: 'danger',
          description: `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        throw error;
      } finally {
        finish();
      }
    },
    [generateFilename, begin, finish]
  );

  // Print function that opens a new window with just the booking details
  const handlePrint = useCallback(
    async (elementId: string) => {
      begin('printing');
      try {
        const element = document.getElementById(elementId);
        if (!element) {
          throw new Error(`Element with id "${elementId}" not found`);
        }

        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          throw new Error(
            'Unable to open print window. Please check popup blockers.'
          );
        }

        // Clone the element to avoid affecting the original
        const printContent = element.cloneNode(true) as HTMLElement;

        // Create print-specific HTML
        const printHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Booking Details - ${booking._id.toString().slice(-8).toUpperCase()}</title>
            <meta charset="utf-8">
            <style>
              @media print {
                body {
                  margin: 0;
                  padding: 20px;
                  font-family: Arial, sans-serif;
                  color: #333;
                  background: white;
                }
                .no-print { display: none !important; }
                * {
                  -webkit-print-color-adjust: exact !important;
                  color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }

              @media screen {
                body {
                  margin: 0;
                  padding: 20px;
                  font-family: Arial, sans-serif;
                  background: white;
                }
              }

              @page {
                margin: 15mm;
                size: A4;
              }
            </style>
          </head>
          <body>
            ${printContent.outerHTML}
          </body>
        </html>
      `;

        // Keep the operation busy until the popup has loaded and printed.
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          let printTimer: number | undefined;
          const closeWatcher = window.setInterval(() => {
            if (printWindow.closed) settle({ kind: 'complete' });
          }, 100);
          const onPageHide = () => {
            if (printWindow.closed) settle({ kind: 'complete' });
          };
          const settle = (
            outcome: { kind: 'complete' } | { kind: 'error'; error: unknown }
          ) => {
            if (settled) return;
            settled = true;
            window.clearInterval(closeWatcher);
            if (printTimer !== undefined) window.clearTimeout(printTimer);
            printWindow.onload = null;
            printWindow.removeEventListener('pagehide', onPageHide);
            if (outcome.kind === 'error') reject(outcome.error);
            else resolve();
          };
          printWindow.addEventListener('pagehide', onPageHide);
          printWindow.onload = () => {
            printWindow.onload = null;
            if (printWindow.closed) {
              settle({ kind: 'complete' });
              return;
            }
            printTimer = window.setTimeout(() => {
              if (printWindow.closed) {
                settle({ kind: 'complete' });
                return;
              }
              try {
                printWindow.print();
                printWindow.close();
                settle({ kind: 'complete' });
              } catch (error) {
                settle({ kind: 'error', error });
              }
            }, 500);
          };
          try {
            printWindow.document.write(printHTML);
            printWindow.document.close();
            if (printWindow.closed) settle({ kind: 'complete' });
          } catch (error) {
            settle({ kind: 'error', error });
          }
        });
      } finally {
        finish();
      }
    },
    [booking._id, begin, finish]
  );

  return {
    isPrinting: operation === 'printing',
    isGeneratingPDF: operation === 'pdf',
    handlePrint,
    handleDownloadPDF,
    handleBrowserPrint,
  };
};
