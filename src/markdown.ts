/**
 * Make a user-controlled string (org login or description, team name, editor name, plan type) safe inside a Markdown
 * table cell: `|` is escaped so it cannot end the cell, and line breaks (which would end the row) become a space.
 */
export function cell(value: string): string {
    return value.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}
