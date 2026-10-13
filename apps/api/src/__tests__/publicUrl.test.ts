import { isPrivateAddress, isPublicHttpsUrl } from '../utils/publicUrl';

describe('server-side fetches stay on the public internet', () => {
    it('knows private, loopback, link-local and metadata addresses', () => {
        for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
            expect(isPrivateAddress(ip)).toBe(true);
        }
        for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700::1111']) expect(isPrivateAddress(ip)).toBe(false);
    });
    it('refuses non-https, credentials, internal names and IP literals in private ranges', async () => {
        expect(await isPublicHttpsUrl('http://example.com/logo.png')).toBe(false);
        expect(await isPublicHttpsUrl('https://user:pw@example.com/logo.png')).toBe(false);
        expect(await isPublicHttpsUrl('https://localhost/logo.png')).toBe(false);
        expect(await isPublicHttpsUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
        expect(await isPublicHttpsUrl('https://[::1]/x')).toBe(false);
        expect(await isPublicHttpsUrl('not a url')).toBe(false);
        expect(await isPublicHttpsUrl('https://8.8.8.8/logo.png')).toBe(true);
    });
});
