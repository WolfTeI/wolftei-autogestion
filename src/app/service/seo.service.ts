import { Inject, Injectable, DOCUMENT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  constructor(
    @Inject(DOCUMENT) private _document: Document,
    public title: Title,
    public meta: Meta,
  ) {}

  setCanonicalURL(url?: string) {
    const canURL = url == undefined ? this._document.URL : url;
    const head = this._document.getElementsByTagName('head')[0];
    let element: HTMLLinkElement | null =
      this._document.querySelector('link[rel="canonical"]') || null;

    if (!element) {
      element = this._document.createElement('link') as HTMLLinkElement;
      head.appendChild(element);
    }
    element.setAttribute('rel', 'canonical');
    element.setAttribute('href', canURL);
  }

  setIndexFollow(state: boolean = true) {
    this.meta.updateTag({
      name: 'robots',
      content: state ? 'index, follow' : 'noindex, nofollow',
    });
  }
  /**
   * Actualiza metaetiquetas SEO, Open Graph y Twitter Card de forma centralizada
   * @param config Objeto con las propiedades: title, description, image, url
   */
  setMetaTags(config: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
    twitterCardType?: string;
  }) {
    if (config.title) {
      this.title.setTitle(config.title);
      this.meta.updateTag({ property: 'og:title', content: config.title });
      this.meta.updateTag({ name: 'twitter:title', content: config.title });
    }
    if (config.description) {
      this.meta.updateTag({ name: 'description', content: config.description });
      this.meta.updateTag({
        property: 'og:description',
        content: config.description,
      });
      this.meta.updateTag({
        name: 'twitter:description',
        content: config.description,
      });
    }

    // Default image if not provided
    const imageUrl =
      config.image || 'https://wolftei.com.ar/assets/Banner.webp';
    const finalImage = imageUrl.startsWith('http')
      ? imageUrl
      : `https://wolftei.com.ar/${imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl}`;

    this.meta.updateTag({ property: 'og:image', content: finalImage });
    this.meta.updateTag({ name: 'twitter:image', content: finalImage });

    // Add image dimensions if generic banner (optional help for whatsapp)
    // this.meta.updateTag({ property: 'og:image:width', content: '1200' });
    // this.meta.updateTag({ property: 'og:image:height', content: '630' });

    if (config.url) {
      this.meta.updateTag({ property: 'og:url', content: config.url });
    }
    this.meta.updateTag({
      property: 'og:type',
      content: config.type || 'website',
    });
    this.meta.updateTag({
      name: 'twitter:card',
      content: config.twitterCardType || 'summary_large_image',
    });
  }
}
