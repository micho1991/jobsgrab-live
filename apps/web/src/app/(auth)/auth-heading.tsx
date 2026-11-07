export function AuthHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-[26px]">{title}</h1>
      {children && <p className="mt-2 text-muted">{children}</p>}
    </div>
  );
}
