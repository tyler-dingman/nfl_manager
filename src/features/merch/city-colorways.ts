import { KOOZIE_PRODUCTS } from './catalog';
import { getTeamBrandTheme } from '@/lib/team-brand-themes';

export type CityColorway = {
  cityCode: string;
  cityName: string;
  primary: string;
  secondary: string;
  textColor: '#ffffff' | '#00172B';
};

export const CITY_COLORWAYS: CityColorway[] = KOOZIE_PRODUCTS.map((product) => {
  const theme = getTeamBrandTheme(product.cityCode);
  return {
    cityCode: product.cityCode!,
    cityName: product.cityName!,
    primary: theme.primary,
    secondary: theme.secondary,
    textColor: ['CIN', 'DEN', 'DET', 'LAC', 'MIA', 'NO', 'PIT'].includes(product.cityCode!)
      ? '#00172B'
      : '#ffffff',
  };
});

export const cityColorway = (cityCode?: string | null) =>
  CITY_COLORWAYS.find((colorway) => colorway.cityCode === cityCode?.toUpperCase());
