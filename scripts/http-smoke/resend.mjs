// Test-only Resend double. No live delivery is possible through this module.
export class Resend {
  emails = {
    send: async input => {
      const response = await fetch(
        `${process.env.SMOKE_PROVIDER_URL}/resend/send`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-smoke-secret': process.env.SMOKE_SECRET,
          },
          body: JSON.stringify({ input }),
        }
      );
      return response.json();
    },
  };
}
