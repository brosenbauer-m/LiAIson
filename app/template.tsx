// Every page fades in gently when you navigate (honours "reduce motion").
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>
}
