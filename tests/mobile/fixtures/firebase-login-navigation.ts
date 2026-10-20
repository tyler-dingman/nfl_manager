export function useSearchParams() {
  return new URLSearchParams('next=/front-office');
}
export function useRouter() {
  return {
    push: (path: string) => {
      document.body.dataset.destination = path;
    },
    replace: (path: string) => {
      document.body.dataset.destination = path;
    },
    refresh: () => {},
  };
}
export function usePathname() {
  return '/login';
}
