import { Hono } from 'npm:hono';
import { createModuleLogger } from "./stderr-logger.ts";

const app = new Hono();
const log = createModuleLogger('rss-proxy');

// Root handler for the RSS proxy service
// Mounted at /make-server-91ed8379/rss-proxy
app.get('/', async (c) => {
  try {
    const url = c.req.query('url');
    
    if (!url) {
      return c.json({ 
        service: 'rss-proxy', 
        status: 'active',
        usage: 'Provide ?url= parameter to fetch RSS feed' 
      });
    }

    // Validate URL
    const allowedDomains = ['investing.com', 'za.investing.com', 'www.investing.com'];
    const parsedUrl = new URL(url);
    const isAllowed = allowedDomains.some(domain => 
      parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      return c.json({ error: 'URL domain not allowed' }, 403);
    }

    log.info('Fetching RSS feed:', { url });

    // Fetch the RSS feed
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      log.error(`RSS fetch failed: ${response.status} ${response.statusText}`);
      return c.json({ 
        error: `Failed to fetch RSS feed: ${response.status} ${response.statusText}` 
      }, response.status);
    }

    const xmlText = await response.text();
    log.info(`Received ${xmlText.length} bytes of XML`);
    
    // Parse XML to JSON
    const items = parseRSStoJSON(xmlText);
    
    log.info(`Successfully parsed ${items.length} items from RSS feed`);
    
    return c.json({
      status: 'ok',
      items: items.slice(0, 20), // Limit to 20 items
      feed: {
        url: url,
        title: extractFeedTitle(xmlText)
      }
    });

  } catch (error) {
    log.error('RSS proxy error:', error);
    return c.json({ 
      error: 'Failed to fetch RSS feed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  author: string;
  description: string;
  thumbnail: string;
  enclosure: { link: string };
}

// Simple XML to JSON parser for RSS feeds
function parseRSStoJSON(xmlText: string): RSSItem[] {
  const items: RSSItem[] = [];
  
  try {
    // Extract all <item> tags
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const matches = xmlText.matchAll(itemRegex);
    
    for (const match of matches) {
      const itemXml = match[1];
      
      // Extract thumbnail from multiple possible sources
      const mediaThumbnail = extractAttribute(itemXml, 'media:thumbnail', 'url');
      const enclosureUrl = extractAttribute(itemXml, 'enclosure', 'url');
      const mediaContent = extractAttribute(itemXml, 'media:content', 'url');
      const descriptionImage = extractImageFromDescription(itemXml);
      
      const thumbnail = mediaThumbnail || enclosureUrl || mediaContent || descriptionImage || '';
      
      const item: RSSItem = {
        title: decodeHTMLEntities(extractTag(itemXml, 'title')),
        link: extractTag(itemXml, 'link'),
        pubDate: extractTag(itemXml, 'pubDate') || new Date().toISOString(),
        author: decodeHTMLEntities(extractTag(itemXml, 'author') || extractTag(itemXml, 'dc:creator') || 'Investing.com'),
        description: decodeHTMLEntities(extractTag(itemXml, 'description')),
        thumbnail: thumbnail,
        enclosure: {
          link: enclosureUrl || thumbnail
        }
      };
      
      // Log first item for debugging
      if (items.length === 0) {
        log.info('First RSS item thumbnail sources:', {
          mediaThumbnail,
          enclosureUrl,
          mediaContent,
          descriptionImage,
          finalThumbnail: thumbnail
        });
      }
      
      items.push(item);
    }
  } catch (error) {
    log.error('Error parsing RSS XML:', error);
  }
  
  return items;
}

function extractTag(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
  const cdataMatch = xml.match(regex);
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }
  
  const simpleRegex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(simpleRegex);
  return match ? match[1].trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1') : '';
}

function extractAttribute(xml: string, tagName: string, attrName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*${attrName}=["']([^"']+)["']`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

// Extract image from description content (some RSS feeds embed images in description)
function extractImageFromDescription(itemXml: string): string {
  const description = extractTag(itemXml, 'description');
  if (!description) return '';
  
  // Try to find img src
  const imgMatch = description.match(/<img[^>]*src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];
  
  // Try to find investing.com specific image patterns
  const invdnMatch = description.match(/https?:\/\/[^"'\s]*i-invdn-com\.investing\.com[^"'\s]*/i);
  if (invdnMatch) return invdnMatch[0];
  
  return '';
}

function extractFeedTitle(xml: string): string {
  const channelMatch = xml.match(/<channel>([\s\S]*?)<\/channel>/i);
  if (channelMatch) {
    const title = extractTag(channelMatch[1], 'title');
    return title || 'RSS Feed';
  }
  return 'RSS Feed';
}

// Decode HTML entities
function decodeHTMLEntities(text: string): string {
  if (!text) return '';
  
  const entities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&#8217;': "'",
    '&#8216;': "'",
    '&#8220;': '"',
    '&#8221;': '"',
    '&#8211;': '\u2013',
    '&#8212;': '\u2014',
    '&ndash;': '\u2013',
    '&mdash;': '\u2014',
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&rdquo;': '"',
    '&ldquo;': '"',
    '&nbsp;': ' ',
    '&#160;': ' ',
    // Handle UTF-8 encoded characters that appear as gibberish
    '\u00e2\u0080\u0099': "'",
    '\u00e2\u0080\u009c': '"',
    '\u00e2\u0080\u009d': '"',
    '\u00e2\u0080\u0094': '\u2014',
    '\u00e2\u0080\u0093': '\u2013',
  };
  
  let decoded = text;
  
  // Replace known entities
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  
  // Handle numeric entities (&#123; or &#xAB;)
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  return decoded;
}

export default app;