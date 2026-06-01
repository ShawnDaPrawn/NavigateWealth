/**
 * email-senders-onboarding.ts — application / client-onboarding / admin notification emails (Phase 5c).
 * ============================================================================
 *
 * Extracted verbatim from email-service.tsx; the SendGrid transport + template
 * engine live in email-core.ts. email-service.tsx re-exports this module so the
 * email-service.ts proxy surface is unchanged.
 */
import { createModuleLogger } from './stderr-logger.ts';
import {
  sendEmail,
  createEmailTemplate,
  getFooterSettings,
  getEmailTemplate,
} from './email-core.ts';

const log = createModuleLogger('email-senders-onboarding');

/**
 * Send admin notification when new application is submitted
 */
export async function sendAdminApplicationNotification(params: {
  applicationNumber: string;
  clientName: string;
  clientEmail: string;
  applicationType: string;
}): Promise<boolean> {
  const { applicationNumber, clientName, clientEmail, applicationType } = params;

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>A new application has been submitted and requires review.</p>
      <p><strong>Application Details:</strong></p>
      <ul>
        <li>Application Number: ${applicationNumber}</li>
        <li>Client Name: ${clientName}</li>
        <li>Client Email: ${clientEmail}</li>
        <li>Application Type: ${applicationType}</li>
      </ul>
      <p>Please log in to the admin panel to review this application.</p>
    `,
    {
      title: 'New Application Submitted',
      buttonUrl: 'https://www.navigatewealth.co/admin',
      buttonLabel: 'Review Application',
      footerSettings,
    },
  );

  const text = `
New Application Submitted

Application Details:
- Application Number: ${applicationNumber}
- Client Name: ${clientName}
- Client Email: ${clientEmail}
- Application Type: ${applicationType}

Please log in to the admin panel to review this application.

Admin Panel: https://www.navigatewealth.co/admin
  `.trim();

  return await sendEmail({
    to: 'info@navigatewealth.co',
    subject: `New Application: ${applicationNumber}`,
    html,
    text,
  });
}

/**
 * Send confirmation email to client when their application is submitted.
 * Uses the application_received template.
 */
export async function sendClientApplicationReceivedEmail(params: {
  to: string;
  clientName: string;
  applicationNumber: string;
}): Promise<boolean> {
  const { to, clientName, applicationNumber } = params;

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>Dear ${clientName},</p>
      <p>Thank you for submitting your application <strong>${applicationNumber}</strong> to Navigate Wealth.</p>
      <p>We have received your application and it is currently being reviewed by our team. We will get back to you shortly with an update on your application status.</p>
      <p>In the meantime, you can check the status of your application by logging in to your account.</p>
    `,
    {
      title: 'Application Received',
      buttonUrl: 'https://www.navigatewealth.co/login',
      buttonLabel: 'Check Application Status',
      footerNote:
        'If you have any questions, contact us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a> or call <a href="tel:+27126672505" style="color: #6d28d9;">(+27) 12-667-2505</a>.',
      footerSettings,
    },
  );

  const text = `
Dear ${clientName},

Thank you for submitting your application ${applicationNumber} to Navigate Wealth.

We have received your application and it is currently being reviewed by our team. We will get back to you shortly with an update on your application status.

In the meantime, you can check the status of your application by logging in at https://www.navigatewealth.co/login.

If you have any questions, contact us at info@navigatewealth.co or call (+27) 12-667-2505.
  `.trim();

  return await sendEmail({
    to,
    subject: `We received your application — ${applicationNumber}`,
    html,
    text,
  });
}

/**
 * Send client approval email
 */
export async function sendClientApprovalEmail(params: {
  to: string;
  clientName: string;
  applicationNumber: string;
}): Promise<boolean> {
  const { to, clientName, applicationNumber } = params;

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>Dear ${clientName},</p>
      <p>Congratulations! Your application <strong>${applicationNumber}</strong> has been approved.</p>
      <p>You now have full access to your Navigate Wealth client portal. Log in to explore your personalized financial dashboard, track your investments, and access our comprehensive suite of financial planning tools.</p>
      <p>Our team is here to support you every step of the way on your financial journey.</p>
    `,
    {
      title: 'Application Approved!',
      buttonUrl: 'https://www.navigatewealth.co/login',
      buttonLabel: 'Access Your Portal',
      footerNote:
        'If you have any questions, contact us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a> or call <a href="tel:+27126672505" style="color: #6d28d9;">(+27) 12-667-2505</a>.',
      footerSettings,
    },
  );

  const text = `
Dear ${clientName},

Congratulations! Your application ${applicationNumber} has been approved.

You now have full access to your Navigate Wealth client portal. Log in to explore your personalized financial dashboard, track your investments, and access our comprehensive suite of financial planning tools.

Access your portal: https://www.navigatewealth.co/login

Our team is here to support you every step of the way on your financial journey.

If you have any questions, contact us at info@navigatewealth.co or call (+27) 12-667-2505.
  `.trim();

  return await sendEmail({
    to,
    subject: 'Your Navigate Wealth Application Has Been Approved!',
    html,
    text,
  });
}

/**
 * Send client decline email
 */
export async function sendClientDeclineEmail(params: {
  to: string;
  clientName: string;
  applicationNumber: string;
  reason?: string;
}): Promise<boolean> {
  const { to, clientName, applicationNumber, reason } = params;

  const footerSettings = await getFooterSettings();

  const reasonText = reason ? `<p><strong>Reason:</strong> ${reason}</p>` : '';

  const html = createEmailTemplate(
    `
      <p>Dear ${clientName},</p>
      <p>Thank you for your interest in Navigate Wealth. After careful review, we are unable to approve your application <strong>${applicationNumber}</strong> at this time.</p>
      ${reasonText}
      <p>If you have any questions or would like to discuss this decision, please don't hesitate to contact us. We're here to help and may be able to provide guidance on alternative options.</p>
    `,
    {
      title: 'Application Status Update',
      buttonUrl: 'https://www.navigatewealth.co/contact',
      buttonLabel: 'Contact Us',
      footerNote:
        'Reach us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a> or call <a href="tel:+27126672505" style="color: #6d28d9;">(+27) 12-667-2505</a>.',
      footerSettings,
    },
  );

  const reasonTextPlain = reason ? `\n\nReason: ${reason}` : '';

  const text = `
Dear ${clientName},

Thank you for your interest in Navigate Wealth. After careful review, we are unable to approve your application ${applicationNumber} at this time.${reasonTextPlain}

If you have any questions or would like to discuss this decision, please don't hesitate to contact us. We're here to help and may be able to provide guidance on alternative options.

Contact us: https://www.navigatewealth.co/contact
Email: info@navigatewealth.co
Phone: (+27) 12-667-2505
  `.trim();

  return await sendEmail({ to, subject: 'Application Status Update', html, text });
}

/**
 * Send admin notification when application is approved
 */
export async function sendAdminApprovalNotification(params: {
  applicationNumber: string;
  clientName: string;
  approvedBy: string;
}): Promise<boolean> {
  const { applicationNumber, clientName, approvedBy } = params;

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>An application has been approved.</p>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Application Number: ${applicationNumber}</li>
        <li>Client Name: ${clientName}</li>
        <li>Approved By: ${approvedBy}</li>
        <li>Timestamp: ${new Date().toLocaleString()}</li>
      </ul>
    `,
    {
      title: 'Application Approved',
      buttonUrl: 'https://www.navigatewealth.co/admin',
      buttonLabel: 'View Admin Panel',
      footerSettings,
    },
  );

  const text = `
Application Approved

Details:
- Application Number: ${applicationNumber}
- Client Name: ${clientName}
- Approved By: ${approvedBy}
- Timestamp: ${new Date().toLocaleString()}

View Admin Panel: https://www.navigatewealth.co/admin
  `.trim();

  return await sendEmail({
    to: 'info@navigatewealth.co',
    subject: `Application Approved: ${applicationNumber}`,
    html,
    text,
  });
}

/**
 * Send admin notification when new user signs up
 */
export async function sendAdminSignupNotification(params: {
  userEmail: string;
  userName: string;
  timestamp: string;
}): Promise<boolean> {
  const { userEmail, userName, timestamp } = params;

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>A new user has signed up on the Navigate Wealth platform.</p>
      <p><strong>User Details:</strong></p>
      <ul>
        <li>Name: ${userName}</li>
        <li>Email: ${userEmail}</li>
        <li>Signup Time: ${timestamp}</li>
      </ul>
      <p>Please review the user's application in the admin panel.</p>
    `,
    {
      title: 'New User Signup',
      buttonUrl: 'https://www.navigatewealth.co/admin',
      buttonLabel: 'View Admin Panel',
      footerSettings,
    },
  );

  const text = `
New User Signup

User Details:
- Name: ${userName}
- Email: ${userEmail}
- Signup Time: ${timestamp}

Please review the user's application in the admin panel.

Admin Panel: https://www.navigatewealth.co/admin
  `.trim();

  return await sendEmail({
    to: 'info@navigatewealth.co',
    subject: 'New User Signup',
    html,
    text,
  });
}

/**
 * Send welcome email to admin-onboarded client upon application approval.
 * Includes a password-setup link so the client can set their own password.
 */
export async function sendAdminOnboardedWelcomeEmail(params: {
  to: string;
  clientName: string;
  applicationNumber: string;
  passwordResetLink: string;
}): Promise<boolean> {
  const { to, clientName, applicationNumber, passwordResetLink } = params;

  const footerSettings = await getFooterSettings();

  const html = createEmailTemplate(
    `
      <p>Dear ${clientName},</p>
      <p>Welcome to <strong>Navigate Wealth</strong>! Your financial adviser has created an account for you, and your application <strong>${applicationNumber}</strong> has been approved.</p>
      <p>To get started, please set up your password by clicking the button below. Once you've set your password, you'll be asked to review and accept our Terms &amp; Conditions before accessing your personalised financial portal.</p>
      <p style="margin-top:24px;"><strong>What you'll find in your portal:</strong></p>
      <ul>
        <li>Your personalised financial dashboard</li>
        <li>Investment and retirement tracking</li>
        <li>Secure document management</li>
        <li>Direct communication with your adviser</li>
      </ul>
    `,
    {
      title: 'Welcome to Navigate Wealth',
      subtitle: 'Your account is ready',
      buttonUrl: passwordResetLink,
      buttonLabel: 'Set Your Password',
      footerNote:
        'This link will expire in 24 hours. If it has expired, visit <a href="https://www.navigatewealth.co/forgot-password" style="color: #6d28d9;">navigatewealth.co/forgot-password</a> to request a new one.<br/><br/>If you did not expect this email, please contact us at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a>.',
      footerSettings,
    },
  );

  const text = `
Dear ${clientName},

Welcome to Navigate Wealth! Your financial adviser has created an account for you, and your application ${applicationNumber} has been approved.

To get started, please set up your password by visiting the link below:
${passwordResetLink}

Once you've set your password, you'll be asked to review and accept our Terms & Conditions before accessing your personalised financial portal.

What you'll find in your portal:
- Your personalised financial dashboard
- Investment and retirement tracking
- Secure document management
- Direct communication with your adviser

This link will expire in 24 hours. If it has expired, visit https://www.navigatewealth.co/forgot-password to request a new one.

If you did not expect this email, please contact us at info@navigatewealth.co.
  `.trim();

  return await sendEmail({
    to,
    subject: 'Welcome to Navigate Wealth — Set Up Your Account',
    html,
    text,
  });
}

/**
 * Send an invitation email to a prospective client inviting them to create
 * their Navigate Wealth account. Uses the `application_invite` transactional
 * template and the base email HTML layout.
 */
export async function sendApplicationInviteEmail(params: {
  to: string;
  clientName: string;
  setupLink: string;
  applicationNumber: string;
}): Promise<boolean> {
  const { to, clientName, setupLink, applicationNumber } = params;

  const template = await getEmailTemplate('application_invite');

  if (!template.enabled) {
    log.info('Application invite email disabled, skipping', { to });
    return true;
  }

  const footerSettings = await getFooterSettings();

  const resolve = (text: string) =>
    text
      .replace(/\{\{ \.Name \}\}/g, clientName)
      .replace(/\{\{ \.SetupLink \}\}/g, setupLink)
      .replace(/\{\{ \.ApplicationNumber \}\}/g, applicationNumber);

  const subject = resolve(template.subject);
  const title = resolve(template.title);
  const subtitle = resolve(template.subtitle);
  const greeting = resolve(template.greeting);
  const bodyContent = resolve(template.bodyHtml);
  const buttonLabel = resolve(template.buttonLabel);
  const buttonUrl = resolve(template.buttonUrl);
  const footerNote = resolve(template.footerNote);

  const html = createEmailTemplate(bodyContent, {
    title,
    subtitle,
    greeting,
    buttonUrl,
    buttonLabel,
    footerNote,
    footerSettings,
  });

  const text = `
${greeting}

You have been personally invited to create an account with Navigate Wealth, South Africa's trusted independent financial advisory firm.

Click the link below to set up your account and get started on your financial journey:
${setupLink}

Our team is ready to assist you every step of the way.

${footerNote}
  `.trim();

  return await sendEmail({ to, subject, html, text });
}
