import { z } from 'zod';
import { UserRole } from '../types';

export const sendMessageSchema = z.object({
  body: z.object({
    recipientId: z.string().min(1, 'Recipient ID is required'),
    recipientRole: z.enum([UserRole.EMPLOYER, UserRole.EMPLOYEE], {
      errorMap: () => ({ message: 'Recipient role must be employer or employee' }),
    }),
    content: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long'),
  }),
});
