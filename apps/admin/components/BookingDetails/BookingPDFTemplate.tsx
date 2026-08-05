import type { PopulatedBooking } from '@/types';
import { getStatusLabel } from '@/utils/bookingUtils';
import { formatCurrency } from '@/utils/utilityFunctions';
import { format } from 'date-fns';

interface BookingPDFTemplateProps {
  booking: PopulatedBooking;
  className?: string;
  id?: string;
}

const printStyles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: '#ffffff',
    color: '#333333',
    lineHeight: '1.5',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '30px',
    borderBottom: '2px solid #2563eb',
    paddingBottom: '20px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#2563eb',
    margin: '0 0 10px 0',
  },
  subtitle: {
    fontSize: '16px',
    color: '#64748b',
    margin: '0',
  },
  section: {
    marginBottom: '25px',
    backgroundColor: '#f8fafc',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '15px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '8px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    alignItems: 'center',
  },
  label: {
    fontWeight: 'bold',
    color: '#64748b',
    minWidth: '150px',
  },
  value: {
    color: '#1e293b',
    textAlign: 'right' as const,
  },
  price: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#059669',
  },
  totalPrice: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#059669',
  },
  status: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #e2e8f0',
    margin: '15px 0',
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: '30px',
    padding: '20px',
    backgroundColor: '#f1f5f9',
    borderRadius: '8px',
    color: '#64748b',
    fontSize: '14px',
  },
};

export default function BookingPDFTemplate({
  booking,
  className,
  id = 'booking-pdf-template',
}: BookingPDFTemplateProps) {
  const formatDate = (date: string | Date) => {
    const parsed = new Date(date);
    return isNaN(parsed.getTime())
      ? 'Invalid date'
      : format(parsed, 'EEEE, MMMM dd, yyyy');
  };
  const formatDateTime = (date: string | Date) => {
    const parsed = new Date(date);
    return isNaN(parsed.getTime())
      ? 'Invalid date'
      : format(parsed, 'MMM dd, yyyy h:mm a');
  };

  const formatPrice = (price: number) => formatCurrency(price);

  const getStatusHexColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { backgroundColor: '#10b981', color: '#ffffff' };
      case 'checked-in':
        return { backgroundColor: '#3b82f6', color: '#ffffff' };
      case 'checked-out':
        return { backgroundColor: '#6b7280', color: '#ffffff' };
      case 'cancelled':
        return { backgroundColor: '#ef4444', color: '#ffffff' };
      default:
        return { backgroundColor: '#f59e0b', color: '#ffffff' };
    }
  };

  const getAddons = () => {
    const addons = [];
    if (booking.extras.hasBreakfast) {
      addons.push(`Breakfast - ${formatPrice(booking.extras.breakfastPrice)}`);
    }
    if (booking.extras.hasPets) {
      addons.push(`Pet Fee - ${formatPrice(booking.extras.petFee)}`);
    }
    if (booking.extras.hasParking) {
      addons.push(`Parking - ${formatPrice(booking.extras.parkingFee)}`);
    }
    if (booking.extras.hasEarlyCheckIn) {
      addons.push(
        `Early Check-in - ${formatPrice(booking.extras.earlyCheckInFee)}`
      );
    }
    if (booking.extras.hasLateCheckOut) {
      addons.push(
        `Late Check-out - ${formatPrice(booking.extras.lateCheckOutFee)}`
      );
    }
    return addons;
  };

  return (
    <div style={printStyles.container} className={className} id={id}>
      {/* Header */}
      <div style={printStyles.header}>
        <h1 style={printStyles.title}>Booking Details</h1>
        <p style={printStyles.subtitle}>
          Generated on {format(new Date(), 'MMMM dd, yyyy')}
        </p>
      </div>

      {/* Booking Information */}
      <div style={printStyles.section}>
        <h2 style={printStyles.sectionTitle}>Booking Information</h2>
        <div style={printStyles.row}>
          <span style={printStyles.label}>Booking ID:</span>
          <span style={printStyles.value}>
            #{booking._id.toString().slice(-8).toUpperCase()}
          </span>
        </div>
        <div style={printStyles.row}>
          <span style={printStyles.label}>Status:</span>
          <span
            style={{
              ...printStyles.status,
              ...getStatusHexColor(booking.status),
            }}
          >
            {getStatusLabel(booking.status)}
          </span>
        </div>
        <div style={printStyles.row}>
          <span style={printStyles.label}>Check-in:</span>
          <span style={printStyles.value}>
            {formatDate(booking.checkInDate)}
          </span>
        </div>
        <div style={printStyles.row}>
          <span style={printStyles.label}>Check-out:</span>
          <span style={printStyles.value}>
            {formatDate(booking.checkOutDate)}
          </span>
        </div>
        <div style={printStyles.row}>
          <span style={printStyles.label}>Duration:</span>
          <span style={printStyles.value}>
            {booking.numNights} night{booking.numNights > 1 ? 's' : ''}
          </span>
        </div>
        <div style={printStyles.row}>
          <span style={printStyles.label}>Guests:</span>
          <span style={printStyles.value}>
            {booking.numGuests} guest{booking.numGuests > 1 ? 's' : ''}
          </span>
        </div>
        {booking.checkInTime && (
          <div style={printStyles.row}>
            <span style={printStyles.label}>Check-in Time:</span>
            <span style={printStyles.value}>
              {format(new Date(booking.checkInTime), 'h:mm a')}
            </span>
          </div>
        )}
        {booking.checkOutTime && (
          <div style={printStyles.row}>
            <span style={printStyles.label}>Check-out Time:</span>
            <span style={printStyles.value}>
              {format(new Date(booking.checkOutTime), 'h:mm a')}
            </span>
          </div>
        )}
        {booking.cancelledAt && (
          <div style={printStyles.row}>
            <span style={printStyles.label}>Cancelled At:</span>
            <span style={printStyles.value}>
              {formatDateTime(booking.cancelledAt)}
            </span>
          </div>
        )}
      </div>

      {/* Guest Information */}
      <div style={printStyles.section}>
        <h2 style={printStyles.sectionTitle}>Guest Information</h2>
        <div style={printStyles.row}>
          <span style={printStyles.label}>Name:</span>
          <span style={printStyles.value}>
            {booking.customer?.first_name ?? ''}{' '}
            {booking.customer?.last_name ?? 'Unknown Guest'}
          </span>
        </div>
        <div style={printStyles.row}>
          <span style={printStyles.label}>Email:</span>
          <span style={printStyles.value}>
            {booking.customer?.email ?? 'N/A'}
          </span>
        </div>
        {booking.customer?.phone && (
          <div style={printStyles.row}>
            <span style={printStyles.label}>Phone:</span>
            <span style={printStyles.value}>{booking.customer.phone}</span>
          </div>
        )}
      </div>

      {/* Cabin Information */}
      <div style={printStyles.section}>
        <h2 style={printStyles.sectionTitle}>Cabin Information</h2>
        <div style={printStyles.row}>
          <span style={printStyles.label}>Cabin:</span>
          <span style={printStyles.value}>{booking.cabin.name}</span>
        </div>
        <div style={printStyles.row}>
          <span style={printStyles.label}>Capacity:</span>
          <span style={printStyles.value}>
            Up to {booking.cabin.capacity} guests
          </span>
        </div>
        <div style={printStyles.row}>
          <span style={printStyles.label}>Nightly Rate:</span>
          <span style={printStyles.value}>
            {formatPrice(booking.cabin.price)}
          </span>
        </div>
      </div>

      {/* Extras */}
      {getAddons().length > 0 && (
        <div style={printStyles.section}>
          <h2 style={printStyles.sectionTitle}>Extras & Add-ons</h2>
          {getAddons().map((addon, index) => {
            const [label, value] = addon.split(' - ');
            return (
              <div key={index} style={printStyles.row}>
                <span style={printStyles.label}>{label}:</span>
                <span style={printStyles.value}>{value}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Summary */}
      <div style={printStyles.section}>
        <h2 style={printStyles.sectionTitle}>Payment Summary</h2>
        <div style={printStyles.row}>
          <span style={printStyles.label}>Cabin Subtotal:</span>
          <span style={printStyles.value}>
            {formatPrice(booking.cabinPrice)}
          </span>
        </div>
        <div style={printStyles.row}>
          <span style={printStyles.label}>Extras Subtotal:</span>
          <span style={printStyles.value}>
            {formatPrice(booking.extrasPrice)}
          </span>
        </div>
        <hr style={printStyles.divider} />
        <div style={printStyles.row}>
          <span style={printStyles.label}>Total:</span>
          <span style={{ ...printStyles.value, ...printStyles.totalPrice }}>
            {formatPrice(booking.totalPrice)}
          </span>
        </div>
        {booking.depositAmount > 0 && (
          <>
            <div style={printStyles.row}>
              <span style={printStyles.label}>Deposit Paid:</span>
              <span style={printStyles.value}>
                {formatPrice(booking.depositAmount)}
              </span>
            </div>
            <div style={printStyles.row}>
              <span style={printStyles.label}>Remaining Balance:</span>
              <span style={printStyles.value}>
                {formatPrice(booking.remainingAmount)}
              </span>
            </div>
          </>
        )}
        <div style={printStyles.row}>
          <span style={printStyles.label}>Payment Status:</span>
          <span
            style={{
              ...printStyles.value,
              color: booking.isPaid ? '#059669' : '#ef4444',
              fontWeight: 'bold',
            }}
          >
            {booking.isPaid ? 'Paid' : 'Unpaid'}
          </span>
        </div>
        {booking.paymentMethod && (
          <div style={printStyles.row}>
            <span style={printStyles.label}>Payment Method:</span>
            <span style={printStyles.value}>
              {booking.paymentMethod.charAt(0).toUpperCase() +
                booking.paymentMethod.slice(1)}
            </span>
          </div>
        )}
        {booking.paidAt && (
          <div style={printStyles.row}>
            <span style={printStyles.label}>Paid At:</span>
            <span style={printStyles.value}>
              {formatDateTime(booking.paidAt)}
            </span>
          </div>
        )}
        {booking.paymentConfirmationSentAt && (
          <div style={printStyles.row}>
            <span style={printStyles.label}>Confirmation Sent:</span>
            <span style={printStyles.value}>
              {formatDateTime(booking.paymentConfirmationSentAt)}
            </span>
          </div>
        )}
        {booking.stripeSessionId && (
          <div style={printStyles.row}>
            <span style={printStyles.label}>Stripe Session:</span>
            <span style={printStyles.value}>{booking.stripeSessionId}</span>
          </div>
        )}
        {booking.stripePaymentIntentId && (
          <div style={printStyles.row}>
            <span style={printStyles.label}>Payment Intent:</span>
            <span style={printStyles.value}>
              {booking.stripePaymentIntentId}
            </span>
          </div>
        )}
        {booking.refundStatus && booking.refundStatus !== 'none' && (
          <>
            <div style={printStyles.row}>
              <span style={printStyles.label}>Refund Status:</span>
              <span style={printStyles.value}>{booking.refundStatus}</span>
            </div>
            {booking.refundAmount !== undefined && (
              <div style={printStyles.row}>
                <span style={printStyles.label}>Refund Amount:</span>
                <span style={printStyles.value}>
                  {formatPrice(booking.refundAmount)}
                </span>
              </div>
            )}
            {booking.refundedAt && (
              <div style={printStyles.row}>
                <span style={printStyles.label}>Refunded At:</span>
                <span style={printStyles.value}>
                  {formatDateTime(booking.refundedAt)}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Notes and Observations */}
      {(booking.observations ||
        booking.specialRequests?.length ||
        booking.cancellationReason) && (
        <div style={printStyles.section}>
          <h2 style={printStyles.sectionTitle}>Notes & Special Requests</h2>
          {booking.observations && (
            <div style={{ marginBottom: '12px' }}>
              <div style={printStyles.label}>Observations:</div>
              <div style={{ marginTop: '4px', color: '#1e293b' }}>
                {booking.observations}
              </div>
            </div>
          )}
          {booking.specialRequests && booking.specialRequests.length > 0 && (
            <div>
              <div style={printStyles.label}>Special Requests:</div>
              <ul
                style={{
                  marginTop: '4px',
                  paddingLeft: '20px',
                  color: '#1e293b',
                }}
              >
                {booking.specialRequests.map((request, index) => (
                  <li key={index}>{request}</li>
                ))}
              </ul>
            </div>
          )}
          {booking.cancellationReason && (
            <div style={{ marginTop: '12px' }}>
              <div style={printStyles.label}>Cancellation Reason:</div>
              <div style={{ marginTop: '4px', color: '#1e293b' }}>
                {booking.cancellationReason}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={printStyles.footer}>
        <p>
          This document was generated by LodgeFlow Admin System.
          <br />
          For questions or assistance, please contact our support team.
        </p>
      </div>
    </div>
  );
}
