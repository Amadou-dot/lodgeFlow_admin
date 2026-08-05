import type { PopulatedBooking } from '@/types';
import { addToast } from '@heroui/toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useCallback, useState } from 'react';

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
  const [isPrinting, setIsPrinting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Generate PDF filename
  const generateFilename = useCallback(
    (customFilename?: string) => {
      if (customFilename) return customFilename;

      const bookingId = booking._id.toString().slice(-8).toUpperCase();
      const guestName =
        `${booking.customer.first_name}-${booking.customer.last_name}`.replace(
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
    window.print();
  }, []);

  // HTML element to canvas and then to PDF
  const handleDownloadPDF = useCallback(
    async (elementId: string, options: UsePrintBookingOptions = {}) => {
      try {
        setIsGeneratingPDF(true);

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
        setIsGeneratingPDF(false);
        addToast({
          color: 'danger',
          description: `Failed to generate PDF: ${(error as Error).message}`,
        });
      } finally {
        setIsGeneratingPDF(false);
      }
    },
    [generateFilename]
  );

  // Print function that opens a new window with just the booking details
  const handlePrint = useCallback(
    async (elementId: string) => {
      try {
        setIsPrinting(true);

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

        // Write content to print window
        printWindow.document.write(printHTML);
        printWindow.document.close();

        // Wait for content to load, then print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 500);
        };
      } finally {
        setIsPrinting(false);
      }
    },
    [booking._id]
  );

  return {
    isPrinting,
    isGeneratingPDF,
    handlePrint,
    handleDownloadPDF,
    handleBrowserPrint,
  };
};
