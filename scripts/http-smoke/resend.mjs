import { Resend as ActualResend } from '__smoke_actual_resend__';

// Keep SDK template rendering real; intercept transport before any live delivery.
export class Resend extends ActualResend {
  constructor() {
    super('re_smoke_only');
    this.fetchRequest = async () => {
      throw new Error('Unexpected live email operation');
    };
    this.post = async (apiPath, input, options) => {
      if (apiPath !== '/emails') throw new Error('Unexpected email operation');
      const response = await fetch(
        `${process.env.SMOKE_PROVIDER_URL}/resend/send`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-smoke-secret': process.env.SMOKE_SECRET,
          },
          body: JSON.stringify({ input, options }),
        }
      );
      return response.json();
    };
  }
}
