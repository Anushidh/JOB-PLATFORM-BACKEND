import redis from './config/redis';

// Repositories
import { UserRepository } from './repositories/user.repository';
import { AuthRepository } from './repositories/auth.repository';
import { CompanyRepository } from './repositories/company.repository';
import { CompanyFollowRepository } from './repositories/companyFollow.repository';
import { ProfileViewRepository } from './repositories/profileView.repository';
import { SavedJobRepository } from './repositories/savedJob.repository';
import { JobRepository } from './repositories/job.repository';
import { JobAnalyticsRepository } from './repositories/jobAnalytics.repository';
import { ApplicationRepository } from './repositories/application.repository';
import { NotificationRepository } from './repositories/notification.repository';
import { MessageRepository } from './repositories/message.repository';
import { SubscriptionRepository } from './repositories/subscription.repository';
import { JobAlertRepository } from './repositories/jobAlert.repository';
import { AdminRepository } from './repositories/admin.repository';

// Adapters
import { SocketRealtimeAdapter } from './services/adapters/realtime.adapter';

// Services
import { EmailService } from './services/email.service';
import { TokenService } from './services/token.service';
import { OtpService } from './services/otp.service';
import { UploadService } from './services/upload.service';
import { UserService } from './services/user.service';
import { AuthService } from './services/auth.service';
import { CompanyService } from './services/company.service';
import { CompanyFollowService } from './services/companyFollow.service';
import { ProfileViewService } from './services/profileView.service';
import { SavedJobService } from './services/savedJob.service';
import { RevenueService } from './services/revenue.service';
import { NotificationService } from './services/notification.service';
import { AnalyticsService } from './services/analytics.service';
import { JobAlertService } from './services/jobAlert.service';
import { JobService } from './services/job.service';
import { ApplicationService } from './services/application.service';
import { MessageService } from './services/message.service';
import { AdminService } from './services/admin.service';
import { InvoiceService } from './services/invoice.service';
import { SubscriptionService } from './services/subscription.service';
import { SubscriptionCronService } from './services/subscriptionCron.service';
import { SubscriptionEntitlementService } from './services/subscriptionEntitlement.service';
import { AIService } from './services/ai.service';

// Controllers
import { UserController } from './controllers/user.controller';
import { AuthController } from './controllers/auth.controller';
import { CompanyController } from './controllers/company.controller';
import { CompanyFollowController } from './controllers/companyFollow.controller';
import { ProfileViewController } from './controllers/profileView.controller';
import { SavedJobController } from './controllers/savedJob.controller';
import { JobController } from './controllers/job.controller';
import { ApplicationController } from './controllers/application.controller';
import { NotificationController } from './controllers/notification.controller';
import { MessageController } from './controllers/message.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { AdminController } from './controllers/admin.controller';
import { SubscriptionController } from './controllers/subscription.controller';
import { JobAlertController } from './controllers/jobAlert.controller';
import { UploadController } from './controllers/upload.controller';
import { AIController } from './controllers/ai.controller';

// Middleware factories
import { createAuthenticateMiddleware } from './middleware/auth';
import { createRequireSubscriptionMiddleware } from './middleware/requireSubscription';

// --- Repositories ---
const userRepository = new UserRepository();
const authRepository = new AuthRepository();
const companyRepository = new CompanyRepository();
const companyFollowRepository = new CompanyFollowRepository();
const profileViewRepository = new ProfileViewRepository();
const savedJobRepository = new SavedJobRepository();
const jobRepository = new JobRepository();
const jobAnalyticsRepository = new JobAnalyticsRepository();
const applicationRepository = new ApplicationRepository();
const notificationRepository = new NotificationRepository();
const messageRepository = new MessageRepository();
const subscriptionRepository = new SubscriptionRepository();
const jobAlertRepository = new JobAlertRepository();
const adminRepository = new AdminRepository();

// --- Infrastructure ---
const realtimeAdapter = new SocketRealtimeAdapter();

// --- Services (leaf first) ---
const emailService = new EmailService();
const tokenService = new TokenService(redis);
const otpService = new OtpService(redis, emailService);
const uploadService = new UploadService();
const userService = new UserService(userRepository);
const authService = new AuthService(authRepository, tokenService, otpService, emailService, redis);
const companyService = new CompanyService(companyRepository);
const companyFollowService = new CompanyFollowService(companyFollowRepository);
const profileViewService = new ProfileViewService(profileViewRepository, userRepository);
const savedJobService = new SavedJobService(savedJobRepository);
const revenueService = new RevenueService(subscriptionRepository);
const notificationService = new NotificationService(notificationRepository, realtimeAdapter);
const analyticsService = new AnalyticsService(jobAnalyticsRepository, jobRepository);
const jobAlertService = new JobAlertService(jobAlertRepository, jobRepository);
const jobService = new JobService(jobRepository, jobAlertService, redis);
const applicationService = new ApplicationService(
  applicationRepository,
  jobRepository,
  userRepository,
  notificationService,
  analyticsService,
  uploadService,
);
const messageService = new MessageService(messageRepository, userRepository, realtimeAdapter);
const adminService = new AdminService(
  adminRepository,
  jobRepository,
  applicationRepository,
  companyRepository,
  notificationService,
  tokenService,
  jobAlertService,
);
const invoiceService = new InvoiceService(adminRepository);
const subscriptionService = new SubscriptionService(
  subscriptionRepository,
  adminRepository,
  invoiceService,
  emailService,
);
const subscriptionCronService = new SubscriptionCronService(
  subscriptionRepository,
  adminRepository,
  emailService,
);
const subscriptionEntitlementService = new SubscriptionEntitlementService(
  subscriptionRepository,
  jobRepository,
  applicationRepository,
  savedJobRepository,
);
const aiService = new AIService(userRepository, jobRepository);

// --- Controllers ---
import { bindMethods } from './utils/bindMethods';

export const userController = bindMethods(new UserController(userService, profileViewService));
export const authController = bindMethods(new AuthController(authService));
export const companyController = bindMethods(new CompanyController(companyService));
export const companyFollowController = bindMethods(new CompanyFollowController(companyFollowService));
export const profileViewController = bindMethods(new ProfileViewController(profileViewService));
export const savedJobController = bindMethods(new SavedJobController(savedJobService));
export const jobController = bindMethods(new JobController(jobService));
export const applicationController = bindMethods(new ApplicationController(applicationService));
export const notificationController = bindMethods(new NotificationController(notificationService));
export const messageController = bindMethods(new MessageController(messageService));
export const analyticsController = bindMethods(new AnalyticsController(analyticsService));
export const adminController = bindMethods(new AdminController(adminService, revenueService));
export const subscriptionController = bindMethods(new SubscriptionController(subscriptionService, invoiceService, subscriptionRepository));
export const jobAlertController = bindMethods(new JobAlertController(jobAlertService));
export const uploadController = bindMethods(new UploadController(uploadService, userRepository, companyRepository));
export const aiController = bindMethods(new AIController(aiService, userRepository, jobRepository));

// Broadcast
import { BroadcastService } from './services/broadcast.service';
import { BroadcastController } from './controllers/broadcast.controller';
const broadcastService = new BroadcastService(notificationRepository);
export const broadcastController = bindMethods(new BroadcastController(broadcastService));

// --- Middleware ---
export const authenticate = createAuthenticateMiddleware(tokenService, authRepository);
export const requireSubscription = createRequireSubscriptionMiddleware(subscriptionEntitlementService);

// --- Cron / OAuth dependencies ---
export { jobAlertService, subscriptionCronService, jobRepository, tokenService };
