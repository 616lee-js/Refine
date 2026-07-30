/**
 * How long a trashed entry survives before its content is destroyed.
 *
 * One constant, imported by the trash view, the purge cron, and the operations
 * guide's stated behaviour — so the number a user is shown and the number the
 * job acts on cannot drift apart.
 *
 * This is an undo window, not retention. When it elapses the text is genuinely
 * destroyed; nothing is archived.
 */
export const TRASH_RETENTION_DAYS = 30;
