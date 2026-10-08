import Link from 'next/link';
import { PROPERTIES } from '@/data/properties';
import { SITE } from '@/data/site';
import { Logo } from './Header';

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
            <h3>Guests</h3>
            <ul>
              <li>
                <Link href="/search">Search stays</Link>
              </li>
              <li>
                <a href="#">Manage my booking</a>
              </li>
              <li>
                <a href="#">FAQ</a>
              </li>
            </ul>
          </div>
          <div>
            <h3>Contact</h3>
            <ul>
              <li>
                <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
              </li>
              <li>Phone placeholder</li>
              <li>Instagram placeholder</li>
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
