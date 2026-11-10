export const TEMPLATE_CONTEXT_VERSION = 1;

export const TEMPLATE_STANDARD = `{%- for project in context.projects -%}
{{ project.name }}:
{%- for item in project.items %}
• {{ item.text }}
{%- endfor %}
{%- unless forloop.last %}

{% endunless -%}
{%- endfor -%}`;

export const TEMPLATE_PARSE_LIMIT = 100_000;

export const TEMPLATE_RENDER_LIMIT_MS = 1_000;

export const TEMPLATE_MEMORY_LIMIT = 10_000_000;

export const TEMPLATE_DATE_TIME_SUFFIX = 'T00:00:00Z';

export const TEMPLATE_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
};

export const TEMPLATE_WEEKDAY_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  timeZone: 'UTC',
};

export const TEMPLATE_NAME_MAX_LENGTH = 64;

export const TEMPLATE_BODY_MAX_LENGTH = 4000;
