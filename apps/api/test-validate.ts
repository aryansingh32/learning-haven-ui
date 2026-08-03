import { validate } from './src/middleware/validate';
import { z } from 'zod';
import { Request, Response } from 'express';

const schema = z.object({
  body: z.object({
    email: z.string().email(),
  })
});

const req = {
  body: {}
} as Request;

const res = {
  status: function(code: number) {
    console.log('Status set to:', code);
    return this;
  },
  json: function(data: any) {
    console.log('JSON sent:', JSON.stringify(data, null, 2));
    return this;
  }
} as Response;

const next = () => {
  console.log('Next called');
};

try {
  const middleware = validate(schema);
  middleware(req, res, next);
} catch (e) {
  console.error('Middleware threw an error:', e);
}
