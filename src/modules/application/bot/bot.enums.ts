export enum BotCommand {
  START = 'start',
  SETTINGS = 'settings',
  ADMIN = 'admin',
  HELP = 'help',
  CANCEL = 'cancel',
}

export enum BotAccess {
  ANYONE = 'anyone',
  EMPLOYEE = 'employee',
  ADMIN = 'admin',
  OWNER = 'owner',
}

export enum BotNamespace {
  ADMIN = 'adm',
  EMPLOYEES = 'emp',
  EMPLOYEE_ADD = 'add',
  EMPLOYEE_BIND = 'bind',
  EMPLOYEE_MANAGE = 'mng',
  EMPLOYEE_PERMISSIONS = 'perm',
  SETTINGS = 'set',
  LABELS = 'lbl',
  LABEL_ADD = 'lbladd',
  LABEL_MANAGE = 'lblmng',
}
