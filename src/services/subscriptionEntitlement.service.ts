import { SubscriptionRepository, PlanType } from '../repositories/subscription.repository';
import { JobRepository } from '../repositories/job.repository';
import { ApplicationRepository } from '../repositories/application.repository';
import { SavedJobRepository } from '../repositories/savedJob.repository';
import { SubscriptionFeature } from '../types';
import { ApiError } from '../utils/apiError';

const FREE_LIMITS = {
  maxJobPosts: 3,
  maxApplications: 10,
  maxSavedJobs: 10,
};

interface ResolvedPlanFeatures {
  plan: PlanType;
  maxJobPosts?: number;
  maxApplications?: number;
  premiumPlacement: boolean;
  resumeAccess: boolean;
  analyticsAccess: boolean;
}

export class SubscriptionEntitlementService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly jobRepository: JobRepository,
    private readonly applicationRepository: ApplicationRepository,
    private readonly savedJobRepository: SavedJobRepository,
  ) {}

  private async resolveFeatures(userId: string): Promise<ResolvedPlanFeatures> {
    const subscription = await this.subscriptionRepository.findActiveForFeatureCheck(userId);

    if (!subscription) {
      return {
        plan: PlanType.FREE,
        maxJobPosts: FREE_LIMITS.maxJobPosts,
        maxApplications: FREE_LIMITS.maxApplications,
        premiumPlacement: false,
        resumeAccess: false,
        analyticsAccess: false,
      };
    }

    return {
      plan: subscription.plan,
      maxJobPosts: subscription.features.maxJobPosts,
      maxApplications: subscription.features.maxApplications,
      premiumPlacement: subscription.features.premiumPlacement,
      resumeAccess: subscription.features.resumeAccess,
      analyticsAccess: subscription.features.analyticsAccess,
    };
  }

  async assertFeature(userId: string, feature: SubscriptionFeature): Promise<void> {
    const { plan, ...features } = await this.resolveFeatures(userId);

    switch (feature) {
      case 'jobPost': {
        if (features.maxJobPosts === undefined) break;
        const currentJobCount = await this.jobRepository.countActiveJobPostsByEmployer(userId);
        if (currentJobCount >= features.maxJobPosts) {
          throw ApiError.forbidden(
            `You have reached the maximum of ${features.maxJobPosts} active job posts on the ${plan} plan. Upgrade to post more.`,
          );
        }
        break;
      }

      case 'application': {
        if (features.maxApplications === undefined) break;
        const currentAppCount = await this.applicationRepository.countApplicationsThisMonth(userId);
        if (currentAppCount >= features.maxApplications) {
          throw ApiError.forbidden(
            `You have reached the maximum of ${features.maxApplications} applications this month on the ${plan} plan. Upgrade to apply more.`,
          );
        }
        break;
      }

      case 'premiumPlacement': {
        if (!features.premiumPlacement) {
          throw ApiError.forbidden(
            `Premium placement is not available on the ${plan} plan. Upgrade to access this feature.`,
          );
        }
        break;
      }

      case 'resumeAccess': {
        if (!features.resumeAccess) {
          throw ApiError.forbidden(
            `Resume/talent pool access is not available on the ${plan} plan. Upgrade to access this feature.`,
          );
        }
        break;
      }

      case 'analyticsAccess': {
        if (!features.analyticsAccess) {
          throw ApiError.forbidden(
            `Analytics is not available on the ${plan} plan. Upgrade to access this feature.`,
          );
        }
        break;
      }

      case 'messaging': {
        if (plan === PlanType.FREE || plan === PlanType.BASIC) {
          throw ApiError.forbidden(
            'Messaging is available on Premium and Enterprise plans only. Upgrade to send messages.',
          );
        }
        break;
      }

      case 'profileViewers': {
        if (plan === PlanType.FREE || plan === PlanType.BASIC) {
          throw ApiError.forbidden(
            '"See who viewed your profile" is available on Premium and Enterprise plans only. Upgrade to access this feature.',
          );
        }
        break;
      }

      case 'savedJobs': {
        let maxSaved: number | undefined;
        if (plan === PlanType.FREE) maxSaved = FREE_LIMITS.maxSavedJobs;
        else if (plan === PlanType.BASIC) maxSaved = 50;
        else maxSaved = undefined;

        if (maxSaved !== undefined) {
          const currentSavedCount = await this.savedJobRepository.countByEmployee(userId);
          if (currentSavedCount >= maxSaved) {
            throw ApiError.forbidden(
              `You have reached the maximum of ${maxSaved} saved jobs on the ${plan} plan. Upgrade to save more.`,
            );
          }
        }
        break;
      }

      default:
        break;
    }
  }
}
