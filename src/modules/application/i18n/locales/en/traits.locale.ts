import type { TraitsLocale } from '../../i18n.interface';
import { enTraitValues } from './trait-values.locale';

export const enTraits: TraitsLocale = {
  traits: enTraitValues,
  traitList: {
    title: (count) => `**Traits** · GitLab labels: ${count}`,
    page: (page, pages) => `Page ${page} of ${pages}`,
    empty:
      'No labels yet. Press "Add": the bot asks for a label as in GitLab and the task trait it stands for.',
    previous: '‹ Back',
    next: 'Next ›',
    add: 'Add',
    menu: 'Menu',
    backToList: 'To the list',
    notFound: 'Label not found: it may have been deleted.',
    everyone: 'For everyone',
    addValue: 'Add a trait',
    drop: 'Delete the label',
  },
  traitManage: {
    askValue: (label, whom, dimension, value) =>
      `${label} ${whom} · ${dimension}\nNow: ${value}. Choose another trait or delete this one.`,
    deleteValue: 'Delete the trait',
    back: '‹ Back',
    changed: (label, whom, value) => `Done: ${label} ${whom} — now ${value}.`,
    valueDeleted: (label, whom, value) => `Trait deleted: ${label} ${whom} — ${value}.`,
    labelEmpty: 'The label has no traits left and is gone from the list.',
    confirmDrop: (label, count) => `Delete the label ${label}? Traits: ${count}.`,
    confirm: 'Yes, delete',
    cancel: 'Cancel',
    dropped: (label) => `The label ${label} is deleted.`,
  },
  traitAdd: {
    prompt:
      'Send the label as in GitLab, for example `status::easy`. Letter case, extra spaces and `_` do not matter.',
    invalid: (max) =>
      `This does not look like a label. Send it as in GitLab, for example \`status::easy\`, up to ${max} characters.`,
    exists: (label) => `The label ${label} is already set up.`,
    forWhom: (label) => `${label}\nWho is the trait for?`,
    everyone: 'For everyone',
    forEveryone: 'for everyone',
    forRole: (role) => `for the ${role} role`,
    chooseDimension: (label, whom) =>
      `${label} ${whom}\nWhat does this label mean? Choose a group of traits.`,
    chooseValue: (label, whom, dimension) =>
      `${label} ${whom} · ${dimension}\nChoose the task trait.`,
    alreadySet: (label) =>
      `The label ${label} already has a trait in this group for this role. You can change it in the card.`,
    added: (label, whom, value) => `Done: ${label} ${whom} — ${value}.`,
    openCard: 'Open the card',
    addMore: 'Add another',
    back: '‹ Back',
    cancel: 'Cancel',
    cancelled: 'Adding cancelled.',
  },
};
