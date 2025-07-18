export const translations = {
  de: {
    // Navigation
    projects: 'Projekte',
    clients: 'Kunden',
    crews: 'Brigaden',
    invoices: 'Rechnungen',
    firms: 'Firmen',
    users: 'Benutzer',
    administration: 'Administration',
    
    // Projects
    projectsTitle: 'Projekte',
    projectsDescription: 'Verwalten Sie Ihre Solarpanel-Installationsprojekte',
    newProject: 'Neues Projekt',
    projectId: 'Projekt ID',
    client: 'Kunde',
    startDate: 'Startdatum',
    endDate: 'Enddatum',
    crew: 'Brigade',
    amount: 'Summe',
    status: 'Status',
    invoice: 'Rechnung',
    actions: 'Aktionen',
    
    // Statuses
    inProgress: 'In Bearbeitung',
    done: 'Abgeschlossen',
    invoiced: 'Berechnet',
    paid: 'Bezahlt',
    
    // Actions
    generateInvoice: 'Rechnung erstellen',
    markAsPaid: 'Als bezahlt markieren',
    edit: 'Bearbeiten',
    view: 'Ansehen',
    delete: 'Löschen',
    archive: 'Archivieren',
    
    // Filters
    allClients: 'Alle Kunden',
    allStatuses: 'Alle Status',
    allCrews: 'Alle Brigaden',
    fromDate: 'Von Datum',
    toDate: 'Bis Datum',
    
    // Stats
    activeProjects: 'Aktive Projekte',
    pendingInvoices: 'Offene Rechnungen',
    monthlyRevenue: 'Monatsumsatz',
    activeCrews: 'Aktive Brigaden',
    
    // Common
    search: 'Suchen',
    save: 'Speichern',
    cancel: 'Abbrechen',
    add: 'Hinzufügen',
    create: 'Erstellen',
    update: 'Aktualisieren',
    loading: 'Laden...',
    error: 'Fehler',
    success: 'Erfolg',
    settings: 'Einstellungen',
    logout: 'Abmelden',
    
    // Messages
    loginRequired: 'Anmeldung erforderlich',
    loggingIn: 'Anmeldung läuft...',
    unauthorized: 'Nicht autorisiert',
    
    // Project Wizard
    projectWizard: 'Projekt-Assistent',
    basicInfo: 'Grundinformationen',
    services: 'Dienstleistungen',
    files: 'Dateien',
    completion: 'Abschluss',
    
    // Forms
    name: 'Name',
    email: 'E-Mail',
    phone: 'Telefon',
    address: 'Adresse',
    description: 'Beschreibung',
    price: 'Preis',
    quantity: 'Menge',
    notes: 'Notizen',
  },
  ru: {
    // Navigation
    projects: 'Проекты',
    clients: 'Клиенты',
    crews: 'Бригады',
    invoices: 'Счета',
    firms: 'Фирмы',
    users: 'Пользователи',
    administration: 'Администрирование',
    
    // Projects
    projectsTitle: 'Проекты',
    projectsDescription: 'Управление проектами установки солнечных панелей',
    newProject: 'Новый проект',
    projectId: 'ID проекта',
    client: 'Клиент',
    startDate: 'Дата начала',
    endDate: 'Дата окончания',
    crew: 'Бригада',
    amount: 'Сумма',
    status: 'Статус',
    invoice: 'Счет',
    actions: 'Действия',
    
    // Statuses
    inProgress: 'В работе',
    done: 'Завершено',
    invoiced: 'Выставлен счет',
    paid: 'Оплачено',
    
    // Actions
    generateInvoice: 'Создать счет',
    markAsPaid: 'Отметить как оплачено',
    edit: 'Редактировать',
    view: 'Просмотр',
    delete: 'Удалить',
    archive: 'Архивировать',
    
    // Filters
    allClients: 'Все клиенты',
    allStatuses: 'Все статусы',
    allCrews: 'Все бригады',
    fromDate: 'С даты',
    toDate: 'По дату',
    
    // Stats
    activeProjects: 'Активные проекты',
    pendingInvoices: 'Неоплаченные счета',
    monthlyRevenue: 'Месячная выручка',
    activeCrews: 'Активные бригады',
    
    // Common
    search: 'Поиск',
    save: 'Сохранить',
    cancel: 'Отмена',
    add: 'Добавить',
    create: 'Создать',
    update: 'Обновить',
    loading: 'Загрузка...',
    error: 'Ошибка',
    success: 'Успех',
    settings: 'Настройки',
    logout: 'Выход',
    
    // Messages
    loginRequiredRu: 'Требуется авторизация',
    loggingInRu: 'Вход в систему...',
    unauthorizedRu: 'Не авторизован',
    
    // Project Wizard
    projectWizardRu: 'Мастер проектов',
    basicInfoRu: 'Основная информация',
    servicesRu: 'Услуги',
    filesRu: 'Файлы',
    completionRu: 'Завершение',
    
    // Forms (Russian specific)
    nameRu: 'Имя',
    emailRu: 'Email',
    phoneRu: 'Телефон',
    addressRu: 'Адрес',
    descriptionRu: 'Описание',
    priceRu: 'Цена',
    quantityRu: 'Количество',
    notesRu: 'Заметки',
  },
};

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations['de'];
