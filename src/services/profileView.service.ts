import { ApiError } from '../utils/apiError';
import { ProfileViewRepository } from '../repositories/profileView.repository';
import { UserRepository } from '../repositories/user.repository';
import { UserRole, PaginationOptions, PaginatedResult } from '../types';

export class ProfileViewService {
  constructor(
    private readonly profileViewRepository: ProfileViewRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async recordView(
    profileOwnerId: string,
    profileOwnerRole: UserRole,
    viewerId: string,
    viewerRole: UserRole,
  ): Promise<void> {
    if (profileOwnerId === viewerId) return;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const existingView = await this.profileViewRepository.findTodayView(profileOwnerId, viewerId, startOfDay);

    if (existingView) return;

    await this.profileViewRepository.create({
      profileOwner: profileOwnerId,
      profileOwnerRole,
      viewer: viewerId,
      viewerRole,
      viewedAt: new Date(),
    });
  }

  async getProfileViewers(
    profileOwnerId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<unknown>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [views, total] = await Promise.all([
      this.profileViewRepository.findByProfileOwner(profileOwnerId, skip, limit),
      this.profileViewRepository.countByProfileOwner(profileOwnerId),
    ]);

    const populatedViews = await Promise.all(
      views.map(async (view) => {
        let viewerInfo: Record<string, unknown> = { _id: view.viewer, role: view.viewerRole };

        if (view.viewerRole === UserRole.EMPLOYER) {
          const employer = await this.userRepository.findEmployerByIdSelect(
            view.viewer.toString(),
            'firstName lastName avatar position',
          );
          if (employer) {
            viewerInfo = {
              _id: employer._id,
              firstName: employer.firstName,
              lastName: employer.lastName,
              avatar: employer.avatar,
              position: employer.position,
              company: (employer as { company?: unknown }).company,
              role: view.viewerRole,
            };
          }
        } else if (view.viewerRole === UserRole.EMPLOYEE) {
          const employee = await this.userRepository.findEmployeeByIdSelect(
            view.viewer.toString(),
            'firstName lastName avatar headline',
          );
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
      }),
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

  async getViewCount(profileOwnerId: string): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.profileViewRepository.countRecentViews(profileOwnerId, thirtyDaysAgo);
  }
}
