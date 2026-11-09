export enum BotCommand {
  START = 'start',
  REPORT = 'report',
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
  TRAITS = 'trt',
  TRAIT_ADD = 'trtadd',
  TRAIT_MANAGE = 'trtmng',
  TRAIT_NAMES = 'trtnm',
  REPORT = 'rpt',
}
