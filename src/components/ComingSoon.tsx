interface ComingSoonProps {
  title: string;
}

const ComingSoon = ({ title }: ComingSoonProps) => {
  return (
    <div className="text-center py-16">
      <h1 className="text-xl font-semibold text-foreground font-display mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground">This section is coming soon.</p>
    </div>
  );
};

export default ComingSoon;
