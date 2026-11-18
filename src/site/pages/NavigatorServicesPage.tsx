/**
 * NavigatorServicesPage — the redesigned /services page.
 *
 * Same SEO tags as the live page (SERVICES_SEO), the same eight services with
 * their highlights, "Learn more" and quote routes, the same "Why Choose" and
 * "How We Work" copy, in the Navigator design. The H1 leads with what people
 * search for; the live headline follows it as the slogan.
 */
import { SEO } from '../../components/seo/SEO';
import { SERVICES_SEO } from '../../components/pages/servicesPageData';
import { ProcessSteps } from '../home/ProcessSteps';
import { ServiceRows, ServicesCta, ServicesHero, WhyChooseSection } from '../home/ServicesSections';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/service.css';
import '../styles/home.css';

export function NavigatorServicesPage() {
  return (
    <div className="nw-site nwx-services">
      <SEO
        title={SERVICES_SEO.title}
        description={SERVICES_SEO.description}
        keywords={SERVICES_SEO.keywords}
        canonicalUrl={SERVICES_SEO.canonicalUrl}
      />
      <ServicesHero />
      <ServiceRows index="01" />
      <WhyChooseSection index="02" />
      <ProcessSteps index="03" variant="services" />
      <ServicesCta />
    </div>
  );
}
