// Файл локализации для поддержки русского и английского языков
export type Language = 'ru' | 'en';

export interface Localization {
  // Общие
  loading: string;
  error: string;
  success: string;
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  create: string;
  update: string;
  search: string;
  filter: string;
  back: string;
  next: string;
  previous: string;
  close: string;
  
  // Навигация
  nav: {
    home: string;
    projects: string;
    clients: string;
    crews: string;
    invoices: string;
    files: string;
    calendar: string;
    settings: string;
    admin: {
      firms: string;
      users: string;
    };
  };
  
  // Проекты
  projects: {
    title: string;
    newProject: string;
    projectDetails: string;
    status: {
      planning: string;
      active: string;
      completed: string;
      cancelled: string;
      invoiced: string;
      paid: string;
    };
    fields: {
      name: string;
      description: string;
      client: string;
      crew: string;
      status: string;
      startDate: string;
      endDate: string;
      workStartDate: string;
      workEndDate: string;
      deliveryDate: string;
      installationPerson: string;
      address: string;
      uniqueId: string;
      phone: string;
    };
  };
  
  // Клиенты
  clients: {
    title: string;
    newClient: string;
    fields: {
      name: string;
      email: string;
      phone: string;
      address: string;
      taxId: string;
    };
  };
  
  // Бригады
  crews: {
    title: string;
    newCrew: string;
    members: string;
    calendar: string;
    fields: {
      name: string;
      uniqueNumber: string;
      description: string;
      memberName: string;
      memberRole: string;
      memberEmail: string;
      memberPhone: string;
    };
  };
  
  // Счета
  invoices: {
    title: string;
    createInvoice: string;
    paymentStatus: {
      pending: string;
      paid: string;
      overdue: string;
    };
    fields: {
      number: string;
      amount: string;
      date: string;
      dueDate: string;
      status: string;
    };
  };
  
  // Настройки
  settings: {
    title: string;
    profile: string;
    account: string;
    preferences: string;
    language: string;
    theme: string;
    notifications: string;
  };
  
  // Администрирование
  admin: {
    firms: {
      title: string;
      newFirm: string;
      manageFirms: string;
      testConnection: string;
      fields: {
        name: string;
        invoiceNinjaUrl: string;
        token: string;
        address: string;
        taxId: string;
        logoUrl: string;
      };
    };
    users: {
      title: string;
      newUser: string;
      roles: {
        admin: string;
        leiter: string;
      };
    };
  };
  
  // Сообщения
  messages: {
    success: {
      saved: string;
      created: string;
      updated: string;
      deleted: string;
      connected: string;
    };
    errors: {
      required: string;
      invalid: string;
      notFound: string;
      serverError: string;
      unauthorized: string;
      forbidden: string;
    };
  };
}

export const locales: Record<Language, Localization> = {
  ru: {
    // Общие
    loading: 'Загрузка...',
    error: 'Ошибка',
    success: 'Успешно',
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    edit: 'Редактировать',
    create: 'Создать',
    update: 'Обновить',
    search: 'Поиск',
    filter: 'Фильтр',
    back: 'Назад',
    next: 'Далее',
    previous: 'Предыдущий',
    close: 'Закрыть',
    
    // Навигация
    nav: {
      home: 'Главная',
      projects: 'Проекты',
      clients: 'Клиенты',
      crews: 'Бригады',
      invoices: 'Счета',
      files: 'Файлы',
      calendar: 'Календарь',
      settings: 'Настройки',
      admin: {
        firms: 'Управление фирмами',
        users: 'Пользователи',
      },
    },
    
    // Проекты
    projects: {
      title: 'Проекты',
      newProject: 'Новый проект',
      projectDetails: 'Детали проекта',
      status: {
        planning: 'Планирование',
        active: 'Активный',
        completed: 'Завершен',
        cancelled: 'Отменен',
        invoiced: 'Выставлен счет',
        paid: 'Оплачен',
      },
      fields: {
        name: 'Название',
        description: 'Описание',
        client: 'Клиент',
        crew: 'Бригада',
        status: 'Статус',
        startDate: 'Дата начала',
        endDate: 'Дата окончания',
        workStartDate: 'Начало работ',
        workEndDate: 'Окончание работ',
        deliveryDate: 'Дата поставки',
        installationPerson: 'Ответственный за установку',
        address: 'Адрес',
        uniqueId: 'Уникальный ID',
        phone: 'Телефон',
      },
    },
    
    // Клиенты
    clients: {
      title: 'Клиенты',
      newClient: 'Новый клиент',
      fields: {
        name: 'Название',
        email: 'Email',
        phone: 'Телефон',
        address: 'Адрес',
        taxId: 'Налоговый номер',
      },
    },
    
    // Бригады
    crews: {
      title: 'Бригады',
      newCrew: 'Новая бригада',
      members: 'Участники',
      calendar: 'Календарь',
      fields: {
        name: 'Название',
        uniqueNumber: 'Уникальный номер',
        description: 'Описание',
        memberName: 'Имя участника',
        memberRole: 'Роль',
        memberEmail: 'Email',
        memberPhone: 'Телефон',
      },
    },
    
    // Счета
    invoices: {
      title: 'Счета',
      createInvoice: 'Создать счет',
      paymentStatus: {
        pending: 'Ожидает оплаты',
        paid: 'Оплачен',
        overdue: 'Просрочен',
      },
      fields: {
        number: 'Номер',
        amount: 'Сумма',
        date: 'Дата',
        dueDate: 'Срок оплаты',
        status: 'Статус',
      },
    },
    
    // Настройки
    settings: {
      title: 'Настройки',
      profile: 'Профиль',
      account: 'Аккаунт',
      preferences: 'Предпочтения',
      language: 'Язык',
      theme: 'Тема',
      notifications: 'Уведомления',
    },
    
    // Администрирование
    admin: {
      firms: {
        title: 'Управление фирмами',
        newFirm: 'Новая фирма',
        manageFirms: 'Управление фирмами',
        testConnection: 'Проверить подключение',
        fields: {
          name: 'Название',
          invoiceNinjaUrl: 'URL Invoice Ninja',
          token: 'API токен',
          address: 'Адрес',
          taxId: 'Налоговый номер',
          logoUrl: 'URL логотипа',
        },
      },
      users: {
        title: 'Пользователи',
        newUser: 'Новый пользователь',
        roles: {
          admin: 'Администратор',
          leiter: 'Руководитель проекта',
        },
      },
    },
    
    // Сообщения
    messages: {
      success: {
        saved: 'Сохранено успешно',
        created: 'Создано успешно',
        updated: 'Обновлено успешно',
        deleted: 'Удалено успешно',
        connected: 'Подключено успешно',
      },
      errors: {
        required: 'Обязательно для заполнения',
        invalid: 'Неверное значение',
        notFound: 'Не найдено',
        serverError: 'Ошибка сервера',
        unauthorized: 'Не авторизован',
        forbidden: 'Доступ запрещен',
      },
    },
  },
  
  en: {
    // Общие
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    update: 'Update',
    search: 'Search',
    filter: 'Filter',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    close: 'Close',
    
    // Навигация
    nav: {
      home: 'Home',
      projects: 'Projects',
      clients: 'Clients',
      crews: 'Crews',
      invoices: 'Invoices',
      files: 'Files',
      calendar: 'Calendar',
      settings: 'Settings',
      admin: {
        firms: 'Firm Management',
        users: 'Users',
      },
    },
    
    // Проекты
    projects: {
      title: 'Projects',
      newProject: 'New Project',
      projectDetails: 'Project Details',
      status: {
        planning: 'Planning',
        active: 'Active',
        completed: 'Completed',
        cancelled: 'Cancelled',
        invoiced: 'Invoiced',
        paid: 'Paid',
      },
      fields: {
        name: 'Name',
        description: 'Description',
        client: 'Client',
        crew: 'Crew',
        status: 'Status',
        startDate: 'Start Date',
        endDate: 'End Date',
        workStartDate: 'Work Start Date',
        workEndDate: 'Work End Date',
        deliveryDate: 'Delivery Date',
        installationPerson: 'Installation Person',
        address: 'Address',
        uniqueId: 'Unique ID',
        phone: 'Phone',
      },
    },
    
    // Клиенты
    clients: {
      title: 'Clients',
      newClient: 'New Client',
      fields: {
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        address: 'Address',
        taxId: 'Tax ID',
      },
    },
    
    // Бригады
    crews: {
      title: 'Crews',
      newCrew: 'New Crew',
      members: 'Members',
      calendar: 'Calendar',
      fields: {
        name: 'Name',
        uniqueNumber: 'Unique Number',
        description: 'Description',
        memberName: 'Member Name',
        memberRole: 'Role',
        memberEmail: 'Email',
        memberPhone: 'Phone',
      },
    },
    
    // Счета
    invoices: {
      title: 'Invoices',
      createInvoice: 'Create Invoice',
      paymentStatus: {
        pending: 'Pending',
        paid: 'Paid',
        overdue: 'Overdue',
      },
      fields: {
        number: 'Number',
        amount: 'Amount',
        date: 'Date',
        dueDate: 'Due Date',
        status: 'Status',
      },
    },
    
    // Настройки
    settings: {
      title: 'Settings',
      profile: 'Profile',
      account: 'Account',
      preferences: 'Preferences',
      language: 'Language',
      theme: 'Theme',
      notifications: 'Notifications',
    },
    
    // Администрирование
    admin: {
      firms: {
        title: 'Firm Management',
        newFirm: 'New Firm',
        manageFirms: 'Manage Firms',
        testConnection: 'Test Connection',
        fields: {
          name: 'Name',
          invoiceNinjaUrl: 'Invoice Ninja URL',
          token: 'API Token',
          address: 'Address',
          taxId: 'Tax ID',
          logoUrl: 'Logo URL',
        },
      },
      users: {
        title: 'Users',
        newUser: 'New User',
        roles: {
          admin: 'Administrator',
          leiter: 'Project Manager',
        },
      },
    },
    
    // Сообщения
    messages: {
      success: {
        saved: 'Saved successfully',
        created: 'Created successfully',
        updated: 'Updated successfully',
        deleted: 'Deleted successfully',
        connected: 'Connected successfully',
      },
      errors: {
        required: 'Required field',
        invalid: 'Invalid value',
        notFound: 'Not found',
        serverError: 'Server error',
        unauthorized: 'Unauthorized',
        forbidden: 'Access denied',
      },
    },
  },
};

// Текущий язык по умолчанию - русский
export const DEFAULT_LANGUAGE: Language = 'ru';

// Хук для получения локализации
export function getLocale(language: Language = DEFAULT_LANGUAGE): Localization {
  return locales[language];
}