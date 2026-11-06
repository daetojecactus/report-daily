import type { TraitsLocale } from '../../i18n.interface';
import { ruTraitValues } from './trait-values.locale';

export const ruTraits: TraitsLocale = {
  traits: ruTraitValues,
  traitList: {
    title: (count) => `**Признаки** · лейблов GitLab: ${count}`,
    page: (page, pages) => `Страница ${page} из ${pages}`,
    empty:
      'Лейблов пока нет. Нажмите «Добавить»: бот спросит лейбл как в GitLab и какой признак задачи он означает.',
    previous: '‹ Назад',
    next: 'Дальше ›',
    add: 'Добавить',
    menu: 'Меню',
    backToList: 'К списку',
    notFound: 'Лейбл не найден: возможно, его уже удалили.',
    everyone: 'Для всех',
    addValue: 'Добавить признак',
    drop: 'Удалить лейбл',
  },
  traitManage: {
    askValue: (label, whom, dimension, value) =>
      `${label} ${whom} · ${dimension}\nСейчас: ${value}. Выберите другой признак или удалите этот.`,
    deleteValue: 'Удалить признак',
    back: '‹ Назад',
    changed: (label, whom, value) => `Готово: ${label} ${whom} — теперь ${value}.`,
    valueDeleted: (label, whom, value) => `Признак удалён: ${label} ${whom} — ${value}.`,
    labelEmpty: 'У лейбла больше нет признаков, он убран из списка.',
    confirmDrop: (label, count) => `Удалить лейбл ${label}? Признаков у него: ${count}.`,
    confirm: 'Да, удалить',
    cancel: 'Отмена',
    dropped: (label) => `Лейбл ${label} удалён.`,
  },
  traitAdd: {
    prompt:
      'Пришлите лейбл как в GitLab, например `status::easy`. Регистр, лишние пробелы и `_` не важны.',
    invalid: (max) =>
      `Не похоже на лейбл. Пришлите его как в GitLab, например \`status::easy\`, не длиннее ${max} символов.`,
    exists: (label) => `Лейбл ${label} уже заведён.`,
    forWhom: (label) => `${label}\nДля кого задать признак?`,
    everyone: 'Для всех',
    forEveryone: 'для всех',
    forRole: (role) => `для роли «${role}»`,
    chooseDimension: (label, whom) =>
      `${label} ${whom}\nЧто этот лейбл значит? Выберите группу признаков.`,
    chooseValue: (label, whom, dimension) =>
      `${label} ${whom} · ${dimension}\nВыберите признак задачи.`,
    alreadySet: (label) =>
      `У лейбла ${label} уже есть признак в этой группе для выбранной роли. Изменить его можно в карточке.`,
    added: (label, whom, value) => `Готово: ${label} ${whom} — ${value}.`,
    openCard: 'Открыть карточку',
    addMore: 'Добавить ещё',
    back: '‹ Назад',
    cancel: 'Отмена',
    cancelled: 'Добавление отменено.',
  },
};
