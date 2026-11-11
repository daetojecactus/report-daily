import type { TraitDimension } from 'src/modules/application/trait/types/trait.enums';
import type { TraitDimensionValueMap } from 'src/modules/application/trait/types/trait.interface';

export interface TraitValueText {
  name: string;
  description: string;
}

export interface TraitsLocale {
  traits: {
    dimensions: Record<TraitDimension, string>;
    values: {
      [Dimension in TraitDimension]: Record<TraitDimensionValueMap[Dimension], TraitValueText>;
    };
  };
  traitList: {
    title: (count: number) => string;
    page: (page: number, pages: number) => string;
    empty: string;
    previous: string;
    next: string;
    add: string;
    menu: string;
    backToList: string;
    notFound: string;
    everyone: string;
    addValue: string;
    drop: string;
    unmapped: (count: number) => string;
  };
  traitNames: {
    title: (count: number) => string;
    hint: (days: number) => string;
    empty: (days: number) => string;
    ignoredTitle: (count: number) => string;
    ignoredHint: string;
    ignoredEmpty: string;
    showIgnored: (count: number) => string;
    showUnmapped: string;
    backToTraits: string;
    card: string;
    ignoredCard: string;
    map: string;
    ignore: string;
    restore: string;
    back: string;
    notFound: string;
    ignored: (label: string) => string;
    restored: (label: string) => string;
  };
  traitManage: {
    askValue: (label: string, whom: string, dimension: string, value: string) => string;
    deleteValue: string;
    back: string;
    changed: (label: string, whom: string, value: string) => string;
    valueDeleted: (label: string, whom: string, value: string) => string;
    labelEmpty: string;
    confirmDrop: (label: string, count: number) => string;
    confirm: string;
    cancel: string;
    dropped: (label: string) => string;
  };
  traitAdd: {
    prompt: string;
    invalid: (max: number) => string;
    exists: (label: string) => string;
    forWhom: (label: string) => string;
    everyone: string;
    forEveryone: string;
    forRole: (role: string) => string;
    chooseDimension: (label: string, whom: string) => string;
    chooseValue: (label: string, whom: string, dimension: string) => string;
    alreadySet: (label: string) => string;
    added: (label: string, whom: string, value: string) => string;
    openCard: string;
    addMore: string;
    back: string;
    cancel: string;
    cancelled: string;
  };
}
