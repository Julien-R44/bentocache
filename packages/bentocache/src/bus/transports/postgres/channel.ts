import { createHash } from 'node:crypto'

/**
 * Postgres truncates identifiers to 63 bytes (NAMEDATALEN - 1) and
 * `pg_notify()` rejects longer channel names.
 */
export const MAX_CHANNEL_BYTES = 63

const HASH_HEX_LENGTH = 16
const MAX_PREFIX_LENGTH = MAX_CHANNEL_BYTES - HASH_HEX_LENGTH - 1

/**
 * Printable ASCII. Anything else may not exist in the database encoding:
 * a LATIN1 database rejects a channel name with Cyrillic or CJK
 * characters, for example.
 */
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/

/**
 * Map a bus channel name to a Postgres channel name, which is always
 * printable ASCII of at most 63 bytes whatever the database encoding is.
 *
 * Non-empty printable ASCII names up to 63 bytes are used as is. Any other name is
 * turned into a prefix, where each character outside printable ASCII is
 * replaced by `_`, cut to 46 characters and suffixed with `~` and the
 * first 16 hex characters of the sha256 of the full name in UTF-8. The
 * hash keeps names that share a prefix distinct.
 *
 * Every instance must compute the same name for the same channel, so this
 * mapping is part of the wire format and must not change.
 */
export function toPostgresChannel(name: string): string {
  /**
   * Postgres rejects an empty channel name, so it is hashed like the others
   */
  if (name.length > 0 && name.length <= MAX_CHANNEL_BYTES && PRINTABLE_ASCII.test(name)) {
    return name
  }

  const hash = createHash('sha256').update(name, 'utf8').digest('hex').slice(0, HASH_HEX_LENGTH)

  let prefix = ''
  for (const char of name) {
    if (prefix.length === MAX_PREFIX_LENGTH) break
    prefix += PRINTABLE_ASCII.test(char) ? char : '_'
  }

  return `${prefix}~${hash}`
}

/**
 * Quote a channel name for `LISTEN` / `UNLISTEN`, which don't accept
 * bind parameters. Quoting also keeps the name case-sensitive, which
 * matches how `pg_notify()` treats its channel argument.
 */
export function quoteChannel(channel: string): string {
  return `"${channel.replace(/"/g, '""')}"`
}
