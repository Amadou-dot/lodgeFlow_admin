import {
  createCustomerSchema,
  updateCustomerSchema,
} from '@/lib/validations/customer';

describe('Customer Validation Schemas', () => {
  describe('createCustomerSchema', () => {
    const validCustomer = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'SecurePass123',
    };

    it('accepts valid customer data', () => {
      const result = createCustomerSchema.safeParse(validCustomer);
      expect(result.success).toBe(true);
    });

    it('rejects missing firstName', () => {
      const { firstName: _firstName, ...customer } = validCustomer;
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(false);
    });

    it('rejects empty firstName', () => {
      const customer = { ...validCustomer, firstName: '' };
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'First name is required'
        );
      }
    });

    it('rejects firstName over 50 characters', () => {
      const customer = { ...validCustomer, firstName: 'A'.repeat(51) };
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(false);
    });

    it('rejects missing lastName', () => {
      const { lastName: _lastName, ...customer } = validCustomer;
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(false);
    });

    it('rejects empty lastName', () => {
      const customer = { ...validCustomer, lastName: '' };
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(false);
    });

    it('rejects missing email', () => {
      const { email: _email, ...customer } = validCustomer;
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
      const invalidEmails = [
        'invalid',
        'invalid@',
        '@example.com',
        'invalid.com',
      ];
      invalidEmails.forEach(email => {
        const customer = { ...validCustomer, email };
        const result = createCustomerSchema.safeParse(customer);
        expect(result.success).toBe(false);
      });
    });

    it('accepts valid email formats', () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user@subdomain.example.com',
      ];
      validEmails.forEach(email => {
        const customer = { ...validCustomer, email };
        const result = createCustomerSchema.safeParse(customer);
        expect(result.success).toBe(true);
      });
    });

    it('rejects missing password', () => {
      const { password: _password, ...customer } = validCustomer;
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(false);
    });

    it('rejects password under 8 characters', () => {
      const customer = { ...validCustomer, password: '1234567' };
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'at least 8 characters'
        );
      }
    });

    it('accepts password at boundary (8 chars)', () => {
      const customer = { ...validCustomer, password: '12345678' };
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(true);
    });

    it('accepts optional phone', () => {
      const customer = { ...validCustomer, phone: '+1234567890' };
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(true);
    });

    it('rejects phone over 20 characters', () => {
      const customer = { ...validCustomer, phone: '1'.repeat(21) };
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(false);
    });

    it('accepts valid nationalId', () => {
      const validIds = ['ABC12345', 'A1B2C3D4E5', 'ABCDE'];
      validIds.forEach(nationalId => {
        const customer = { ...validCustomer, nationalId };
        const result = createCustomerSchema.safeParse(customer);
        expect(result.success).toBe(true);
      });
    });

    it('rejects nationalId under 5 characters', () => {
      const customer = { ...validCustomer, nationalId: 'ABCD' };
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(false);
    });

    it('rejects nationalId over 20 characters', () => {
      const customer = { ...validCustomer, nationalId: 'A'.repeat(21) };
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(false);
    });

    it('rejects nationalId with special characters', () => {
      const customer = { ...validCustomer, nationalId: 'ABC-123' };
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(false);
    });

    it('accepts valid address object', () => {
      const customer = {
        ...validCustomer,
        address: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          country: 'USA',
          zipCode: '10001',
        },
      };
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(true);
    });

    it('accepts partial address', () => {
      const customer = {
        ...validCustomer,
        address: {
          city: 'New York',
        },
      };
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(true);
    });

    it('accepts valid emergency contact', () => {
      const customer = {
        ...validCustomer,
        emergencyContact: {
          name: 'Jane Doe',
          phone: '+1234567890',
          relationship: 'Spouse',
        },
      };
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(true);
    });

    it('accepts valid preferences', () => {
      const customer = {
        ...validCustomer,
        preferences: {
          roomType: 'suite',
          floorPreference: 'high',
          dietaryRestrictions: ['vegetarian', 'gluten-free'],
          specialRequests: 'Early check-in please',
        },
      };
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(true);
    });

    it('rejects specialRequests over 500 characters', () => {
      const customer = {
        ...validCustomer,
        preferences: {
          specialRequests: 'A'.repeat(501),
        },
      };
      const result = createCustomerSchema.safeParse(customer);
      expect(result.success).toBe(false);
    });
  });

  describe('updateCustomerSchema', () => {
    it('accepts empty update', () => {
      const result = updateCustomerSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts partial updates', () => {
      const result = updateCustomerSchema.safeParse({
        firstName: 'Jane',
        lastName: 'Smith',
      });
      expect(result.success).toBe(true);
    });

    it('accepts username update', () => {
      const result = updateCustomerSchema.safeParse({
        username: 'johndoe123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects username under 3 characters', () => {
      const result = updateCustomerSchema.safeParse({
        username: 'ab',
      });
      expect(result.success).toBe(false);
    });

    it('rejects username over 50 characters', () => {
      const result = updateCustomerSchema.safeParse({
        username: 'a'.repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it('validates nationalId format on update', () => {
      const result = updateCustomerSchema.safeParse({
        nationalId: 'INVALID-ID',
      });
      expect(result.success).toBe(false);
    });

    it('accepts address update', () => {
      const result = updateCustomerSchema.safeParse({
        address: {
          city: 'Los Angeles',
          state: 'CA',
        },
      });
      expect(result.success).toBe(true);
    });

    it('accepts emergency contact update', () => {
      const result = updateCustomerSchema.safeParse({
        emergencyContact: {
          name: 'John Smith',
          phone: '+9876543210',
        },
      });
      expect(result.success).toBe(true);
    });

    it('accepts preferences update', () => {
      const result = updateCustomerSchema.safeParse({
        preferences: {
          dietaryRestrictions: ['vegan'],
        },
      });
      expect(result.success).toBe(true);
    });
  });
});
