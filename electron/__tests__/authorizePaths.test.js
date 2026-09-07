import { describe, it, expect } from 'vitest'
import { filterAuthorizablePaths } from '../authorizePaths.js'

describe('filterAuthorizablePaths', () => {
    it('keeps absolute paths without ".."', () => {
        expect(filterAuthorizablePaths(['/home/u/a.md', '/tmp/b.txt']))
            .toEqual(['/home/u/a.md', '/tmp/b.txt'])
    })

    it('drops relative paths, "..", and non-strings', () => {
        expect(filterAuthorizablePaths([
            'rel/path.md',
            '/home/u/../etc/passwd',
            '',
            null,
            42,
            undefined,
        ])).toEqual([])
    })

    it('returns [] for non-array input', () => {
        expect(filterAuthorizablePaths(null)).toEqual([])
        expect(filterAuthorizablePaths('/a/b')).toEqual([])
    })

    it('normalises with resolve (collapses . and trailing slash)', () => {
        expect(filterAuthorizablePaths(['/home/u/./a.md', '/home/u/dir/']))
            .toEqual(['/home/u/a.md', '/home/u/dir'])
    })
})
