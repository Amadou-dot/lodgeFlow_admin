import {
  CallToActionSection,
  PageHeader,
  SectionHeader,
  StatsGrid,
  TeamGrid,
  ValuesGrid,
} from '@/components/ui';
import { siteConfig } from '@/config/site';
import { Sprout, Sparkles, Mountain, Handshake } from 'lucide-react';

export default function AboutPage() {
  const cabinCount = 12;
  const yearFounded = 2010;
  const yearsEstablished = new Date().getFullYear() - yearFounded;
  const customerCount = 10000;
  const pristineAcres = 500;

  const stats = [
    { label: 'Years of Excellence', value: `${yearsEstablished}+` },
    { label: 'Happy Guests', value: `${customerCount}+` },
    { label: 'Pristine Acres', value: `${pristineAcres}+` },
    { label: 'Luxury Cabins', value: `${cabinCount}+` },
  ];

  const values = [
    {
      title: 'Sustainability',
      description:
        "We're committed to preserving the natural beauty that surrounds us through eco-friendly practices and conservation efforts.",
      icon: (
        <Sprout className='w-12 h-12 text-green-600 dark:text-green-400 mx-auto' />
      ),
    },
    {
      title: 'Luxury & Comfort',
      description:
        'Every detail is carefully curated to provide you with the ultimate comfort while maintaining harmony with nature.',
      icon: (
        <Sparkles className='w-12 h-12 text-yellow-600 dark:text-yellow-400 mx-auto' />
      ),
    },
    {
      title: 'Authentic Experiences',
      description:
        'From guided nature walks to stargazing sessions, we offer genuine connections with the wilderness.',
      icon: (
        <Mountain className='w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto' />
      ),
    },
    {
      title: 'Personalized Service',
      description:
        'Our dedicated team ensures every guest receives personalized attention and creates memories that last a lifetime.',
      icon: (
        <Handshake className='w-12 h-12 text-purple-600 dark:text-purple-400 mx-auto' />
      ),
    },
  ];

  const team = [
    {
      name: 'Sarah Linden',
      role: 'Co-Founder & CEO',
      bio: "A lifelong advocate for sustainable living, Sarah brings visionary leadership and a deep reverence for nature to LodgeFlow. With a background in environmental science and eco-tourism, she's the driving force behind the resort's commitment to luxury without compromise. Her calm presence and strategic mind have shaped LodgeFlow into a sanctuary that honors both the land and the guests who walk it.",
      image: '/sarah_linden.png',
      tagline:
        "Luxury should never come at nature's expense. At LodgeFlow, we prove it doesn't have to.",
    },
    {
      name: 'Michael Rowan',
      role: 'Co-Founder & COO',
      bio: "Michael's hands-on approach and love for the outdoors make him the heartbeat of LodgeFlow's day-to-day operations. A former wilderness guide and sustainability consultant, he ensures every cabin, trail, and system runs in harmony with the environment. His practical ingenuity and deep respect for the valley's ecosystem have helped LodgeFlow thrive without disturbing its natural rhythm.",
      image: '/michael_rowan.png',
      tagline: "We don't just build cabins—we build trust with the land.",
    },
    {
      name: 'James Smith',
      role: 'Operations Manager',
      bio: 'James is the quiet force that keeps LodgeFlow running smoothly. With a background in sustainable engineering and logistics, he oversees everything from water systems to trail maintenance. His meticulous planning and problem-solving ensure that every guest experience is seamless—and every footprint is light.',
      image: '/james_smith.png',
      tagline:
        'Behind every peaceful moment is a thousand moving parts. I make sure they move gently.',
    },
    {
      name: 'Emily Wren',
      role: 'Guest Experience Manager',
      bio: "Emily is the warm smile behind every unforgettable stay. With a background in hospitality and a passion for storytelling, she curates experiences that connect guests to the soul of the wilderness. Whether it's a sunrise hike, a stargazing evening, or a handwritten welcome note, Emily ensures every detail feels personal and poetic.",
      image: '/emily_wren.png',
      tagline: 'Nature speaks softly. I help guests hear it.',
    },
    {
      name: 'David Lee',
      role: 'Head Chef',
      bio: "David's culinary philosophy is rooted in simplicity, seasonality, and sustainability. Trained in both farm-to-table cuisine and wild foraging, he transforms local ingredients into elegant dishes that reflect the valley's bounty. His kitchen is powered by renewable energy and his menus change with the land—each plate a tribute to the region's flavors.",
      image: '/david_lee.png',
      tagline: "The forest is our pantry. I just listen to what it's offering.",
    },
    {
      name: 'Sophia Patel',
      role: 'Marketing Director',
      bio: "Sophia blends strategy with soul, crafting LodgeFlow's brand as a beacon for eco-conscious travelers. With a background in ethical branding and digital storytelling, she's the voice behind every campaign, blog post, and social moment. Her work invites guests not just to visit—but to belong.",
      image: '/sophia_patel.png',
      tagline: "We don't sell escapes. We share a way of being.",
    },
  ];

  return (
    <div className='space-y-16 py-8'>
      {/* Hero Section */}
      <PageHeader
        subtitle={`Nestled in the heart of pristine wilderness, LodgeFlow has been a sanctuary for those seeking to reconnect with nature's tranquility since ${yearFounded}.`}
        title='About'
        titleAccent='LodgeFlow'
      />

      {/* Story Section */}
      <section className='grid grid-cols-1 lg:grid-cols-2 gap-12 items-center'>
        <div>
          <SectionHeader centered={false} className='mb-6' title='Our Story' />
          <div className='space-y-4 text-default-600'>
            <p>
              What began as a dream to create a perfect escape from the modern
              world has evolved into a premier destination that honors both
              luxury and nature's raw beauty.
            </p>
            <p>
              Founded by environmental enthusiasts Sarah and Michael Chen,
              LodgeFlow was born from their vision of sustainable luxury
              tourism. After years of traveling the world, they discovered this
              untouched valley and knew they had found something special.
            </p>
            <p>
              Today, our resort spans over {pristineAcres} acres of protected
              wilderness, featuring {cabinCount} thoughtfully designed cabins
              that blend seamlessly into the natural landscape. Each structure
              was built using sustainable materials and powered by renewable
              energy.
            </p>
          </div>
        </div>
        <div className='relative'>
          <div className='w-full h-96 rounded-2xl overflow-hidden'>
            <img
              alt='LodgeFlow Founders - Sarah Linden and Michael Rowan'
              className='w-full h-full object-cover'
              src='/lodgeflow_founders.png'
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className='bg-green-50 dark:bg-green-950 rounded-2xl p-8'>
        <StatsGrid stats={stats} />
      </section>

      {/* Values Section */}
      <section>
        <SectionHeader
          className='mb-12'
          subtitle='The principles that guide everything we do at LodgeFlow'
          title='Our Values'
        />
        <ValuesGrid values={values} />
      </section>

      {/* Team Section */}
      <section>
        <SectionHeader
          className='mb-12'
          subtitle='The passionate people who make your LodgeFlow experience unforgettable'
          title='Meet Our Team'
        />
        <TeamGrid maxDisplay={6} members={team} />
      </section>

      {/* Call to Action */}
      <CallToActionSection
        subtitle='Join thousands of guests who have discovered their perfect escape in nature'
        title='Ready to Experience LodgeFlow?'
        buttons={[
          {
            label: 'Book Your Stay',
            href: '/cabins',
            color: 'primary',
          },
          {
            label: 'Contact Us',
            href: siteConfig.links.email,
            variant: 'bordered',
          },
        ]}
      />
    </div>
  );
}
