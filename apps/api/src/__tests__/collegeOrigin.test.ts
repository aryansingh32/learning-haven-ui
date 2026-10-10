/** College portals (vit.forge.com) may call the API from the browser; look-alikes may not. */
import { isCollegePortalOrigin } from '../utils/collegeOrigin';

describe('isCollegePortalOrigin', () => {
    const ok = (o: string) => isCollegePortalOrigin(o, 'forge.com');

    it('allows one https subdomain of the base domain', () => {
        expect(ok('https://vit.forge.com')).toBe(true);
        expect(ok('https://iit-delhi.forge.com')).toBe(true);
    });

    it('refuses http, nesting, look-alikes and other ports', () => {
        expect(ok('http://vit.forge.com')).toBe(false);
        expect(ok('https://a.b.forge.com')).toBe(false);
        expect(ok('https://vit.forge.com.evil.io')).toBe(false);
        expect(ok('https://evilforge.com')).toBe(false);
        expect(ok('https://forge.com')).toBe(false);
        expect(ok('https://vit.forgexcom')).toBe(false);
    });

    it('allows nothing when no base domain is set', () => {
        expect(isCollegePortalOrigin('https://vit.forge.com', undefined)).toBe(false);
    });
});
