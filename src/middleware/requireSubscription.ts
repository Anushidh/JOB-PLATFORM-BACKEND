import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { SubscriptionFeature } from '../types';
import { SubscriptionEntitlementService } from '../services/subscriptionEntitlement.service';

export type { SubscriptionFeature };

export const createRequireSubscriptionMiddleware = (
  entitlementService: SubscriptionEntitlementService,
) => {
  return (feature: SubscriptionFeature) => {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.userId;

        if (!userId) {
          return next(ApiError.unauthorized('Authentication required'));
        }

        await entitlementService.assertFeature(userId, feature);
        next();
      } catch (error) {
        next(error);
      }
    };
  };
};
