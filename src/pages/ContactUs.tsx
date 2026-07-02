import { useState } from "react";
import { Send, Mail, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const ContactUs = () => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !subject || !message) {
      toast.error("Please fill in all fields.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("https://formspree.io/f/mgojpydr", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (!res.ok) throw new Error("Formspree request failed");
      toast.success("Message sent! We'll get back to you within 24–48 hours.");
      setSubject("");
      setMessage("");
    } catch {
      toast.error("Couldn't send your message. Please try again or email us directly.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground font-display">Contact Us</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Help us improve GenuineCRO by reporting bugs, suggesting features, or sharing your thoughts.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact Form */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Send a Message</h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subject" className="text-xs">Subject</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Inquiry</SelectItem>
                      <SelectItem value="billing">Billing & Subscription</SelectItem>
                      <SelectItem value="technical">Technical Support</SelectItem>
                      <SelectItem value="feature">Feature Request</SelectItem>
                      <SelectItem value="bug">Bug Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-xs">Message</Label>
                  <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your question or issue…" rows={4} />
                </div>
                <Button type="submit" disabled={sending} className="w-full">
                  {sending ? "Sending…" : <><Send className="h-3.5 w-3.5 mr-1.5" /> Send Message</>}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Email Us</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  For general inquiries & support: <span className="text-foreground font-medium">experiments@genuinecro.com</span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Response Times</h2>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>General inquiries</span>
                    <span className="text-foreground">24–48 hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Technical support</span>
                    <span className="text-foreground">12–24 hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Billing issues</span>
                    <span className="text-foreground">12–24 hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bug reports</span>
                    <span className="text-foreground">24–48 hours</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default ContactUs;
