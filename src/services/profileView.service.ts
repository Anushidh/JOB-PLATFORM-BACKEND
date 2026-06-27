import ProfileView, { IProfileView } from '../models/ProfileView';
import Employee from '../models/Employee';
import Employer from '../models/Employer';
import { ApiError } from '../utils/apiError';
import { UserRole, PaginationOptions, PaginatedResult } from '../types';

class ProfileViewService {
  /** Records a profile view. Limits to one view per viewer per profile per day. */
  async recordView(
    profileOwnerId: string,
    profileOwnerRole: UserRole,
    viewerId: string,
    viewerRole: UserRole
  ): Promise<void> {
    // Don't record self-views
    if (profileOwnerId === viewerId) return;

    // Check if this viewer already viewed this profile today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const existingView = await ProfileView.findOne({
      profileOwner: profileOwnerId,
      viewer: viewerId,
      viewedAt: { $gte: startOfDay },
    });

    if (existingView) return; // Already recorded today

    await ProfileView.create({
      profileOwner: profileOwnerId,
      profileOwnerRole: profileOwnerRole,
      viewer: viewerId,
      viewerRole: viewerRole,
      viewedAt: new Date(),
    });
  }

  /** Returns paginated list of users who viewed the profile (Premium+ only) */
  async getProfileViewers(
    profileOwnerId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<any>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const query = { profileOwner: profileOwnerId };

    const [views, total] = await Promise.all([
      ProfileView.find(query)
        .sort({ viewedAt: -1 })
        .skip(skip)
        .limit(limit),
      ProfileView.countDocuments(query),
    ]);

    // Populate viewer details
    const populatedViews = await Promise.all(
      views.map(async (view) => {
        let viewerInfo: any = { _id: view.viewer, role: view.viewerRole };

        if (view.viewerRole === UserRole.EMPLOYER) {
          const employer = await Employer.findById(view.viewer)
            .select('firstName lastName avatar position')
            .populate('company', 'name logoUrl');
          if (employer) {
            viewerInfo = {
              _id: employer._id,
              firstName: employer.firstName,
              lastName: employer.lastName,
              avatar: employer.avatar,
              position: employer.position,
              company: (employer as any).company,
              role: view.viewerRole,
            };
          }
        } else if (view.viewerRole === UserRole.EMPLOYEE) {
          const employee = await Employee.findById(view.viewer)
            .select('firstName lastName avatar headline');
          if (employee) {
            viewerInfo = {
              _id: employee._id,
              firstName: employee.firstName,
              lastName: employee.lastName,
              avatar: employee.avatar,
              headline: employee.headline,
              role: view.viewerRole,
            };
          }
        }

        return {
          viewer: viewerInfo,
          viewedAt: view.viewedAt,
        };
      })
    );

    return {
      data: populatedViews,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /** Returns the total number of profile views (last 30 days) */
  async getViewCount(profileOwnerId: string): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return ProfileView.countDocuments({
      profileOwner: profileOwnerId,
      viewedAt: { $gte: thirtyDaysAgo },
    });
  }
}

export default new ProfileViewService();
