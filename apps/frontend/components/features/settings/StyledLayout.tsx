import { ReactNode } from 'react';

interface IProps {
  children: ReactNode;
  title: string;
}

const StyledSettingsLayout = ({ children, title }: IProps) => {
  return (
    <div className="flex w-full items-center justify-center px-24 py-10">
      <div className="w-full max-w-7xl">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        {children}
      </div>
    </div>
  );
};

export default StyledSettingsLayout;
