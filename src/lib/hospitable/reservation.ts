import 'server-only';
import { hospitableFetch } from './client';

/** The parts of a Hospitable v2 reservation the Meta Purchase event uses. */
export type HospitableReservation = {
  id: string;
  code: string | null;
  platform: string;
  booking_date: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  status?: string | null;
  reservation_status?: { current?: { category?: string | null } | null } | null;
  guests?: { total?: number | null } | null;
  financials?: {
    currency?: string | null;
    guest?: { total_price?: { amount?: number | null } | null } | null;
  } | null;
  properties?: { id: string }[] | null;
  guest?: {
    id?: string | number | null;
    email?: string | null;
    phone_numbers?: string[] | null;
    first_name?: string | null;
    last_name?: string | null;
    location?: string | null;
  } | null;
};

/**
 * Reads a reservation straight from Hospitable. The webhook body is only used
 * for the reservation id, so a forged webhook can't invent a booking.
 */
export async function getReservation(id: string): Promise<HospitableReservation> {
  const res = await hospitableFetch<{ data: HospitableReservation }>(`/reservations/${encodeURIComponent(id)}`, {
    query: { include: 'guest,financials,properties' },
  });
  return res.data;
}
