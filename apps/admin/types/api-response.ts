/** Serialized admin envelopes. These types do not validate untrusted JSON. */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Existing operations that acknowledge success without a data field. */
export type ApiAcknowledgement =
  { success: true; message?: string } | ApiErrorResponse;
