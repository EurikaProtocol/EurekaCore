import { PageHero, RouteButton } from '../components/ui';

export function NotFoundPage() {
  return (
    <PageHero
      eyebrow='404'
      title='Route not found'
      description='Use the main navigation to return to the verified EUREKA Protocol routes.'
      actions={<RouteButton label='Go home' to='/' />}
    />
  );
}
