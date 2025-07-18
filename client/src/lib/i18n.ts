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
    description: 'Beschreibung',
    price: 'Preis',
    quantity: 'Menge',
    notes: 'Notizen',
    address: 'Adresse',
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
    loginRequired: 'Требуется авторизация',
    loggingIn: 'Вход в систему...',
    unauthorized: 'Не авторизован',
    
    // Project Wizard
    projectWizard: 'Мастер проектов',
    basicInfo: 'Основная информация',
    services: 'Услуги',
    files: 'Файлы',
    completion: 'Завершение',
    
    // Forms
    name: 'Имя',
    email: 'Email',
    phone: 'Телефон',
    address: 'Адрес',
    description: 'Описание',
    price: 'Цена',
    quantity: 'Количество',
    notes: 'Заметки',
  },
};

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations['de'];
