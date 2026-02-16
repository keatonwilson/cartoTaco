import { describe, it, expect } from 'vitest';
import {
  validateName,
  validateType,
  validateAddress,
  validateShortDescription,
  validateLongDescription,
  validatePhone,
  validateUrl,
  validateInstagram,
  validateFacebook,
  validateCoordinates,
  validateTime,
  validateDayHours,
  validateSubmissionForm
} from './validation.js';

describe('validateName', () => {
  it('rejects empty name', () => {
    expect(validateName('').valid).toBe(false);
    expect(validateName(null).valid).toBe(false);
    expect(validateName(undefined).valid).toBe(false);
  });

  it('rejects name shorter than 3 characters', () => {
    expect(validateName('AB').valid).toBe(false);
  });

  it('rejects name longer than 100 characters', () => {
    expect(validateName('A'.repeat(101)).valid).toBe(false);
  });

  it('accepts valid name', () => {
    expect(validateName('El Guero Canelo').valid).toBe(true);
  });
});

describe('validateType', () => {
  it('accepts valid types', () => {
    expect(validateType('Brick and Mortar').valid).toBe(true);
    expect(validateType('Stand').valid).toBe(true);
    expect(validateType('Truck').valid).toBe(true);
  });

  it('rejects invalid types', () => {
    expect(validateType('Restaurant').valid).toBe(false);
    expect(validateType(null).valid).toBe(false);
  });
});

describe('validateAddress', () => {
  it('rejects empty or short address', () => {
    expect(validateAddress('').valid).toBe(false);
    expect(validateAddress('123 Main').valid).toBe(false);
  });

  it('accepts valid address', () => {
    expect(validateAddress('1234 S 6th Ave, Tucson, AZ').valid).toBe(true);
  });
});

describe('validateShortDescription', () => {
  it('rejects empty or too-short descriptions', () => {
    expect(validateShortDescription('').valid).toBe(false);
    expect(validateShortDescription('Short').valid).toBe(false);
  });

  it('rejects descriptions over 150 chars', () => {
    expect(validateShortDescription('A'.repeat(151)).valid).toBe(false);
  });

  it('accepts valid description', () => {
    expect(validateShortDescription('Great Sonoran-style tacos with amazing salsa bar').valid).toBe(true);
  });
});

describe('validateLongDescription', () => {
  it('allows empty (optional field)', () => {
    expect(validateLongDescription(null).valid).toBe(true);
    expect(validateLongDescription(undefined).valid).toBe(true);
  });

  it('rejects descriptions over 500 chars', () => {
    expect(validateLongDescription('A'.repeat(501)).valid).toBe(false);
  });

  it('accepts valid long description', () => {
    expect(validateLongDescription('A detailed description of the place.').valid).toBe(true);
  });
});

describe('validatePhone', () => {
  it('allows empty (optional field)', () => {
    expect(validatePhone(null).valid).toBe(true);
    expect(validatePhone(undefined).valid).toBe(true);
  });

  it('accepts various valid formats', () => {
    expect(validatePhone('(520) 123-4567').valid).toBe(true);
    expect(validatePhone('520-123-4567').valid).toBe(true);
    expect(validatePhone('5201234567').valid).toBe(true);
    expect(validatePhone('123-4567').valid).toBe(true);
  });

  it('rejects invalid phone numbers', () => {
    expect(validatePhone('123').valid).toBe(false);
    expect(validatePhone('abcdefghij').valid).toBe(false);
  });
});

describe('validateUrl', () => {
  it('allows empty (optional field)', () => {
    expect(validateUrl(null).valid).toBe(true);
  });

  it('accepts valid URLs', () => {
    expect(validateUrl('https://example.com').valid).toBe(true);
    expect(validateUrl('http://tacospot.com/menu').valid).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(validateUrl('not-a-url').valid).toBe(false);
  });
});

describe('validateInstagram', () => {
  it('allows empty (optional field)', () => {
    expect(validateInstagram(null).valid).toBe(true);
  });

  it('accepts valid handles with or without @', () => {
    expect(validateInstagram('@taco_spot').valid).toBe(true);
    expect(validateInstagram('taco_spot').valid).toBe(true);
    expect(validateInstagram('taco.spot.123').valid).toBe(true);
  });

  it('rejects handles with invalid characters', () => {
    expect(validateInstagram('taco spot!').valid).toBe(false);
  });

  it('rejects handles over 30 characters', () => {
    expect(validateInstagram('a'.repeat(31)).valid).toBe(false);
  });
});

describe('validateFacebook', () => {
  it('allows empty (optional field)', () => {
    expect(validateFacebook(null).valid).toBe(true);
  });

  it('accepts page names', () => {
    expect(validateFacebook('TacoSpot').valid).toBe(true);
    expect(validateFacebook('taco-spot.az').valid).toBe(true);
  });

  it('accepts full Facebook URLs', () => {
    expect(validateFacebook('https://facebook.com/TacoSpot').valid).toBe(true);
  });

  it('rejects invalid page names', () => {
    expect(validateFacebook('taco spot!').valid).toBe(false);
  });
});

describe('validateCoordinates', () => {
  it('rejects missing coordinates', () => {
    expect(validateCoordinates(null, -110.9).valid).toBe(false);
    expect(validateCoordinates(32.2, null).valid).toBe(false);
  });

  it('rejects out-of-range coordinates', () => {
    expect(validateCoordinates(91, -110.9).valid).toBe(false);
    expect(validateCoordinates(32.2, -181).valid).toBe(false);
  });

  it('rejects coordinates outside Tucson area', () => {
    // Phoenix area
    expect(validateCoordinates(33.5, -112.0).valid).toBe(false);
    // Way outside
    expect(validateCoordinates(32.2, -109.0).valid).toBe(false);
  });

  it('accepts valid Tucson coordinates', () => {
    expect(validateCoordinates(32.2226, -110.9747).valid).toBe(true);
  });
});

describe('validateTime', () => {
  it('allows empty (optional)', () => {
    expect(validateTime(null).valid).toBe(true);
    expect(validateTime(undefined).valid).toBe(true);
  });

  it('accepts valid times', () => {
    expect(validateTime('08:00').valid).toBe(true);
    expect(validateTime('8:00').valid).toBe(true);
    expect(validateTime('23:59').valid).toBe(true);
    expect(validateTime('0:00').valid).toBe(true);
  });

  it('rejects invalid times', () => {
    expect(validateTime('25:00').valid).toBe(false);
    expect(validateTime('12:60').valid).toBe(false);
    expect(validateTime('noon').valid).toBe(false);
  });
});

describe('validateDayHours', () => {
  it('allows null (closed day)', () => {
    expect(validateDayHours(null).valid).toBe(true);
  });

  it('accepts valid open/close times', () => {
    expect(validateDayHours({ open: '08:00', close: '17:00' }).valid).toBe(true);
  });

  it('rejects close before open', () => {
    expect(validateDayHours({ open: '17:00', close: '08:00' }).valid).toBe(false);
  });

  it('rejects invalid time formats', () => {
    expect(validateDayHours({ open: 'noon', close: '17:00' }).valid).toBe(false);
  });
});

describe('validateSubmissionForm', () => {
  const validForm = {
    name: 'El Guero Canelo',
    type: 'Brick and Mortar',
    address: '5201 S 12th Ave, Tucson, AZ 85706',
    short_description: 'Sonoran hot dogs and amazing tacos',
    latitude: 32.1815,
    longitude: -110.9685
  };

  it('accepts a valid complete form', () => {
    const result = validateSubmissionForm(validForm);
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('collects multiple errors', () => {
    const result = validateSubmissionForm({});
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).length).toBeGreaterThan(0);
    expect(result.errors.name).toBeDefined();
    expect(result.errors.type).toBeDefined();
    expect(result.errors.address).toBeDefined();
  });

  it('validates optional fields when provided', () => {
    const result = validateSubmissionForm({
      ...validForm,
      phone: 'invalid',
      instagram: 'invalid handle!!!'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.phone).toBeDefined();
    expect(result.errors.instagram).toBeDefined();
  });
});
