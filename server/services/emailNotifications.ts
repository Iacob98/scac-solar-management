import { MailService } from '@sendgrid/mail';
import { db } from '../db';
import { crews, crewMembers, projects, clients, firms } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

if (!process.env.SENDGRID_API_KEY) {
  console.warn('SENDGRID_API_KEY not configured - email notifications disabled');
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailProjectInfo {
  projectId: number;
  firmId: string;
  clientName: string;
  installationAddress: string;
  installationPerson: string;
  installationPhone: string;
  workStartDate: string | null;
  workEndDate: string | null;
  equipmentExpectedDate: string | null;
  projectStatus: string;
  notes: string | null;
  uniqueNumber: string | null;
}

interface CrewMemberEmail {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export class EmailNotificationService {
  
  /**
   * Отправить уведомление о новом назначении проекта
   */
  async sendProjectAssignmentNotification(projectId: number, crewId: number) {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('Email notifications disabled - SENDGRID_API_KEY not configured');
      return false;
    }

    try {
      const projectInfo = await this.getProjectInfo(projectId);
      const crewEmails = await this.getCrewMemberEmails(crewId);
      
      if (crewEmails.length === 0) {
        console.log('No email addresses found for crew members');
        return false;
      }

      const subject = `Новое назначение: Проект ${projectInfo.uniqueNumber || projectInfo.projectId}`;
      const emailContent = this.generateProjectAssignmentEmail(projectInfo);

      for (const member of crewEmails) {
        await this.sendEmail({
          to: member.email,
          subject,
          html: emailContent,
          memberName: `${member.firstName} ${member.lastName}`
        });
      }

      return true;
    } catch (error) {
      console.error('Error sending project assignment notification:', error);
      return false;
    }
  }

  /**
   * Отправить уведомление об изменении даты проекта
   */
  async sendProjectDateUpdateNotification(projectId: number, crewId: number, changeType: 'work_date' | 'equipment_date') {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('Email notifications disabled - SENDGRID_API_KEY not configured');
      return false;
    }

    try {
      const projectInfo = await this.getProjectInfo(projectId);
      const crewEmails = await this.getCrewMemberEmails(crewId);
      
      if (crewEmails.length === 0) {
        return false;
      }

      const subject = `Изменение сроков: Проект ${projectInfo.uniqueNumber || projectInfo.projectId}`;
      const emailContent = this.generateDateUpdateEmail(projectInfo, changeType);

      for (const member of crewEmails) {
        await this.sendEmail({
          to: member.email,
          subject,
          html: emailContent,
          memberName: `${member.firstName} ${member.lastName}`
        });
      }

      return true;
    } catch (error) {
      console.error('Error sending date update notification:', error);
      return false;
    }
  }

  /**
   * Отправить уведомление о готовности оборудования
   */
  async sendEquipmentReadyNotification(projectId: number, crewId: number) {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('Email notifications disabled - SENDGRID_API_KEY not configured');
      return false;
    }

    try {
      const projectInfo = await this.getProjectInfo(projectId);
      const crewEmails = await this.getCrewMemberEmails(crewId);
      
      if (crewEmails.length === 0) {
        return false;
      }

      const subject = `Оборудование готово: Проект ${projectInfo.uniqueNumber || projectInfo.projectId}`;
      const emailContent = this.generateEquipmentReadyEmail(projectInfo);

      for (const member of crewEmails) {
        await this.sendEmail({
          to: member.email,
          subject,
          html: emailContent,
          memberName: `${member.firstName} ${member.lastName}`
        });
      }

      return true;
    } catch (error) {
      console.error('Error sending equipment ready notification:', error);
      return false;
    }
  }

  /**
   * Получить информацию о проекте
   */
  private async getProjectInfo(projectId: number): Promise<EmailProjectInfo> {
    const [projectData] = await db
      .select({
        projectId: projects.id,
        firmId: projects.firmId,
        clientName: clients.name,
        installationAddress: projects.installationPersonAddress,
        installationPersonFirstName: projects.installationPersonFirstName,
        installationPersonLastName: projects.installationPersonLastName,
        installationPhone: projects.installationPersonPhone,
        workStartDate: projects.workStartDate,
        workEndDate: projects.workEndDate,
        equipmentExpectedDate: projects.equipmentExpectedDate,
        projectStatus: projects.status,
        notes: projects.notes,
        uniqueNumber: projects.teamNumber,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!projectData) {
      throw new Error(`Project ${projectId} not found`);
    }

    const installationPerson = projectData.installationPersonFirstName && projectData.installationPersonLastName 
      ? `${projectData.installationPersonFirstName} ${projectData.installationPersonLastName}`
      : 'Не указано';

    return {
      projectId: projectData.projectId,
      firmId: projectData.firmId,
      clientName: projectData.clientName || 'Не указано',
      installationAddress: projectData.installationAddress || 'Не указано',
      installationPerson,
      installationPhone: projectData.installationPhone || 'Не указано',
      workStartDate: projectData.workStartDate,
      workEndDate: projectData.workEndDate,
      equipmentExpectedDate: projectData.equipmentExpectedDate,
      projectStatus: projectData.projectStatus,
      notes: projectData.notes,
      uniqueNumber: projectData.uniqueNumber,
    };
  }

  /**
   * Получить email адреса участников бригады
   */
  private async getCrewMemberEmails(crewId: number): Promise<CrewMemberEmail[]> {
    const members = await db
      .select({
        firstName: crewMembers.firstName,
        lastName: crewMembers.lastName,
        email: crewMembers.memberEmail,
        role: crewMembers.role,
      })
      .from(crewMembers)
      .where(and(
        eq(crewMembers.crewId, crewId),
        // Только участники с указанным email
      ))
      .execute();

    return members
      .filter(member => member.email && member.email.trim() !== '')
      .map(member => ({
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email!,
        role: member.role || 'worker'
      }));
  }

  /**
   * Генерировать содержимое письма о назначении проекта
   */
  private generateProjectAssignmentEmail(project: EmailProjectInfo): string {
    const workDates = project.workStartDate && project.workEndDate 
      ? `с ${this.formatDate(project.workStartDate)} по ${this.formatDate(project.workEndDate)}`
      : 'Даты работ не назначены';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Новое назначение проекта</h2>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">Информация о проекте</h3>
          <p><strong>Номер проекта:</strong> ${project.uniqueNumber || project.projectId}</p>
          <p><strong>Клиент:</strong> ${project.clientName}</p>
          <p><strong>Статус:</strong> ${this.getStatusText(project.projectStatus)}</p>
          <p><strong>Даты работ:</strong> ${workDates}</p>
        </div>

        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0369a1;">Место установки</h3>
          <p><strong>Адрес:</strong> ${project.installationAddress}</p>
          <p><strong>Контактное лицо:</strong> ${project.installationPerson}</p>
          <p><strong>Телефон:</strong> ${project.installationPhone}</p>
        </div>

        ${project.equipmentExpectedDate ? `
          <div style="background-color: #fffbeb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #d97706;">Оборудование</h3>
            <p><strong>Ожидаемая дата поставки:</strong> ${this.formatDate(project.equipmentExpectedDate)}</p>
          </div>
        ` : ''}

        ${project.notes ? `
          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #475569;">Дополнительные заметки</h3>
            <p>${project.notes}</p>
          </div>
        ` : ''}

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">
          <p>Это автоматическое уведомление от системы управления проектами SCAC.</p>
        </div>
      </div>
    `;
  }

  /**
   * Генерировать содержимое письма об изменении дат
   */
  private generateDateUpdateEmail(project: EmailProjectInfo, changeType: 'work_date' | 'equipment_date'): string {
    const title = changeType === 'work_date' ? 'Изменение дат работ' : 'Изменение сроков поставки оборудования';
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">${title}</h2>
        
        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <h3 style="margin-top: 0; color: #991b1b;">Внимание! Изменились сроки</h3>
          <p><strong>Проект:</strong> ${project.uniqueNumber || project.projectId}</p>
          <p><strong>Клиент:</strong> ${project.clientName}</p>
        </div>

        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">Актуальная информация</h3>
          ${changeType === 'work_date' ? `
            <p><strong>Новые даты работ:</strong> ${
              project.workStartDate && project.workEndDate 
                ? `с ${this.formatDate(project.workStartDate)} по ${this.formatDate(project.workEndDate)}`
                : 'Не назначены'
            }</p>
          ` : `
            <p><strong>Новая дата поставки оборудования:</strong> ${
              project.equipmentExpectedDate 
                ? this.formatDate(project.equipmentExpectedDate)
                : 'Не назначена'
            }</p>
          `}
        </div>

        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0369a1;">Место установки</h3>
          <p><strong>Адрес:</strong> ${project.installationAddress}</p>
          <p><strong>Контактное лицо:</strong> ${project.installationPerson}</p>
          <p><strong>Телефон:</strong> ${project.installationPhone}</p>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">
          <p>Это автоматическое уведомление от системы управления проектами SCAC.</p>
        </div>
      </div>
    `;
  }

  /**
   * Генерировать содержимое письма о готовности оборудования
   */
  private generateEquipmentReadyEmail(project: EmailProjectInfo): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Оборудование готово к установке</h2>
        
        <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <h3 style="margin-top: 0; color: #047857;">Хорошие новости!</h3>
          <p>Оборудование для проекта <strong>${project.uniqueNumber || project.projectId}</strong> готово и доставлено.</p>
          <p>Можно приступать к установке согласно расписанию.</p>
        </div>

        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">Информация о проекте</h3>
          <p><strong>Клиент:</strong> ${project.clientName}</p>
          <p><strong>Запланированные даты работ:</strong> ${
            project.workStartDate && project.workEndDate 
              ? `с ${this.formatDate(project.workStartDate)} по ${this.formatDate(project.workEndDate)}`
              : 'Не назначены'
          }</p>
        </div>

        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0369a1;">Место установки</h3>
          <p><strong>Адрес:</strong> ${project.installationAddress}</p>
          <p><strong>Контактное лицо:</strong> ${project.installationPerson}</p>
          <p><strong>Телефон:</strong> ${project.installationPhone}</p>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">
          <p>Это автоматическое уведомление от системы управления проектами SCAC.</p>
        </div>
      </div>
    `;
  }

  /**
   * Отправить email
   */
  private async sendEmail({ to, subject, html, memberName }: {
    to: string;
    subject: string;
    html: string;
    memberName: string;
  }) {
    const personalizedHtml = html.replace('{{memberName}}', memberName);
    
    await mailService.send({
      to,
      from: 'noreply@scac-system.com', // Замените на ваш верифицированный домен
      subject,
      html: personalizedHtml,
    });

    console.log(`Email notification sent to ${memberName} (${to}): ${subject}`);
  }

  /**
   * Форматировать дату
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  }

  /**
   * Получить текст статуса проекта
   */
  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'planning': 'Планирование',
      'equipment_waiting': 'Ожидание оборудования',
      'equipment_arrived': 'Оборудование прибыло',
      'work_scheduled': 'Работы запланированы',
      'work_in_progress': 'Работы выполняются',
      'work_completed': 'Работы завершены',
      'invoiced': 'Выставлен счет',
      'paid': 'Оплачено'
    };
    return statusMap[status] || status;
  }
}

export const emailNotificationService = new EmailNotificationService();