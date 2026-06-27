import { Request, Response, NextFunction } from 'express';
import Subscription, { SubscriptionStatus, PlanType } from '../models/Subscription';
import Job from '../models/Job';
import Application from '../models/Application';
import SavedJob from '../models/SavedJob';
import { ApiError } from '../utils/apiError';
import { AuthRequest } from '../types';

export type SubscriptionFeature =
  | 'jobPost'
  | 'application'
  | 'premiumPlacement'
  | 'resumeAccess'
  | 'analyticsAccess'
  | 'messaging'
  | 'profileViewers'
  | 'savedJobs';

// Free tier limits
const FREE_LIMITS = {
  maxJobPosts: 3,
  maxApplications: 10,
  maxSavedJobs: 10,
};

/**
 * Middleware that checks if the user's subscription allows a specific feature.
 * Falls back to free tier limits if no active subscription exists.
 */
export const requireSubscription = (feature: SubscriptionFeature) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;

      if (!userId) {
        return next(ApiError.unauthorized('Authentication required'));
      }

      // Get active subscription
      const subscription = await Subscription.findOne({
        user: userId,
        status: SubscriptionStatus.ACTIVE,
        endDate: { $gte: new Date() },
      });

      // Determine plan features
      const plan = subscription?.plan || PlanType.FREE;
      const features = subscription?.features || {
        maxJobPosts: FREE_LIMITS.maxJobPosts,
        maxApplications: FREE_LIMITS.maxApplications,
        premiumPlacement: false,
        resumeAccess: false,
        analyticsAccess: false,
      };

      switch (feature) {
        case 'jobPost': {
          if (features.maxJobPosts === undefined) {
            // Unlimited
            break;
          }
          const currentJobCount = await Job.countDocuments({
            employer: userId,
            isDeleted: false,
            status: { $ne: 'closed' },
          });
          if (currentJobCount >= features.maxJobPosts) {
            return next(
              ApiError.forbidden(
                `You have reached the maximum of ${features.maxJobPosts} active job posts on the ${plan} plan. Upgrade to post more.`
              )
            );
          }
          break;
        }

        case 'application': {
          if (features.maxApplications === undefined) {
            // Unlimited
            break;
          }
          // Count applications this month
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          const currentAppCount = await Application.countDocuments({
            applicant: userId,
            createdAt: { $gte: startOfMonth },
          });
          if (currentAppCount >= features.maxApplications) {
            return next(
              ApiError.forbidden(
                `You have reached the maximum of ${features.maxApplications} applications this month on the ${plan} plan. Upgrade to apply more.`
              )
            );
          }
          break;
        }

        case 'premiumPlacement': {
          if (!features.premiumPlacement) {
            return next(
              ApiError.forbidden(
                `Premium placement is not available on the ${plan} plan. Upgrade to access this feature.`
              )
            );
          }
          break;
        }

        case 'resumeAccess': {
          if (!features.resumeAccess) {
            return next(
              ApiError.forbidden(
                `Resume/talent pool access is not available on the ${plan} plan. Upgrade to access this feature.`
              )
            );
          }
          break;
        }

        case 'analyticsAccess': {
          if (!features.analyticsAccess) {
            return next(
              ApiError.forbidden(
                `Analytics is not available on the ${plan} plan. Upgrade to access this feature.`
              )
            );
          }
          break;
        }

        case 'messaging': {
          // Messaging requires Premium or above (not available on Free or Basic)
          if (plan === PlanType.FREE || plan === PlanType.BASIC) {
            return next(
              ApiError.forbidden(
                `Messaging is available on Premium and Enterprise plans only. Upgrade to send messages.`
              )
            );
          }
          break;
        }

        case 'profileViewers': {
          // Seeing who viewed your profile requires Premium or above
          if (plan === PlanType.FREE || plan === PlanType.BASIC) {
            return next(
              ApiError.forbidden(
                `"See who viewed your profile" is available on Premium and Enterprise plans only. Upgrade to access this feature.`
              )
            );
          }
          break;
        }

        case 'savedJobs': {
          // Saved jobs are limited by plan: Free = 10, Basic = 50, Premium+ = unlimited
          let maxSaved: number | undefined;
          if (plan === PlanType.FREE) maxSaved = 10;
          else if (plan === PlanType.BASIC) maxSaved = 50;
          else maxSaved = undefined; // unlimited for Premium/Enterprise

          if (maxSaved !== undefined) {
            const currentSavedCount = await SavedJob.countDocuments({ employee: userId });
            if (currentSavedCount >= maxSaved) {
              return next(
                ApiError.forbidden(
                  `You have reached the maximum of ${maxSaved} saved jobs on the ${plan} plan. Upgrade to save more.`
                )
              );
            }
          }
          break;
        }

        default:
          break;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
