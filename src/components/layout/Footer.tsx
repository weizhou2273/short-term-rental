import Link from 'next/link';
import { getGuide, guidePath } from '@/data/guides';
import { PROPERTIES } from '@/data/properties';
import { SITE } from '@/data/site';
import { Logo } from './Header';

/** A few guides in the footer link every page to them; the rest are one click away on /poconos. */
const FOOTER_GUIDES = [
  'near-camelback-mountain',
  'near-kalahari-resort',
  'large-group-rentals',
  'ski-rentals',
  'rentals-with-hot-tub-and-sauna',
  'pet-friendly-rentals',
].flatMap((slug) => getGuide(slug) ?? []);

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-cols">
          <div>
            <Logo />
            <p className="muted">Private estates in the Pocono Mountains, booked direct.</p>
          </div>
          <div>
            <h3>Stays</h3>
            <ul>
              {PROPERTIES.map((p) => (
                <li key={p.id}>
                  <Link href={`/stays/${p.slug}`}>{p.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Explore</h3>
            <ul>
              {FOOTER_GUIDES.map((g) => (
                <li key={g.slug}>
                  <Link href={guidePath(g)}>{g.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/poconos">All Poconos guides</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>Guests</h3>
            <ul>
              <li>
                <Link href="/search">Search stays</Link>
              </li>
              <li>
                <a href="#">FAQ</a>
              </li>
            </ul>
          </div>
          <div id="contact" className="footer-contact">
            <h3>Contact</h3>
            <ul>
              <li>
                <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
              </li>
              <li>
                <a href={`tel:${SITE.contactPhone.replace(/[^\d+]/g, '')}`}>{SITE.contactPhone}</a>
              </li>
              <li>
                <a href={`https://www.instagram.com/${SITE.instagram}/`} target="_blank" rel="noopener noreferrer">
                  Instagram @{SITE.instagram}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {SITE.brand}
          </span>
          <span>
            <a href="#">Terms</a> &nbsp; <a href="#">Privacy</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
