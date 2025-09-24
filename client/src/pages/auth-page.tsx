import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Hotel, Users, Shield } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [activeTab, setActiveTab] = useState("login");

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      userType: "construction",
      companyName: "",
      contactInfo: "",
    },
  });

  // Redirect if already logged in
  if (user) {
    return <Redirect to="/" />;
  }

  const handleLogin = async (data: LoginForm) => {
    try {
      await loginMutation.mutateAsync({
        email: data.email,
        password: data.password,
      });
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleRegister = async (data: RegisterForm) => {
    try {
      const { confirmPassword, ...registerData } = data;
      await registerMutation.mutateAsync(registerData);
    } catch (error) {
      console.error("Register error:", error);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground">
        <div className="flex flex-col justify-center px-12 py-16">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">CrewStay</h1>
            <p className="text-xl text-primary-foreground/90 mb-8">
              Streamline construction worker housing management with seamless coordination between companies and hotels.
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">For Construction Companies</h3>
                <p className="text-primary-foreground/80">
                  Manage your crew accommodations with unique worker IDs, real-time room assignments, and extension requests.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Hotel className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">For Hotel Partners</h3>
                <p className="text-primary-foreground/80">
                  Efficiently manage room assignments, track occupancy, and handle extension requests with instant notifications.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Real-time Coordination</h3>
                <p className="text-primary-foreground/80">
                  Live updates, instant notifications, and seamless communication between all parties.
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-white/20">
            <div className="flex items-center space-x-2 text-primary-foreground/70">
              <Shield className="w-4 h-4" />
              <span className="text-sm">Secure, reliable, and built for construction industry professionals</span>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Forms */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-foreground">
                Welcome to CrewStay
              </CardTitle>
              <p className="text-muted-foreground">
                Sign in to your account or create a new one
              </p>
            </CardHeader>
            
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login" data-testid="tab-login">Sign In</TabsTrigger>
                  <TabsTrigger value="register" data-testid="tab-register">Create Account</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login">
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                    <div>
                      <Label htmlFor="login-email">Email Address</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="admin@company.com"
                        data-testid="input-login-email"
                        {...loginForm.register("email")}
                      />
                      {loginForm.formState.errors.email && (
                        <p className="text-sm text-destructive mt-1">
                          {loginForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        data-testid="input-login-password"
                        {...loginForm.register("password")}
                      />
                      {loginForm.formState.errors.password && (
                        <p className="text-sm text-destructive mt-1">
                          {loginForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                      data-testid="button-login"
                    >
                      {loginMutation.isPending ? "Signing In..." : "Sign In"}
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="register">
                  <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                    <div>
                      <Label htmlFor="register-userType">Account Type</Label>
                      <Select
                        value={registerForm.watch("userType")}
                        onValueChange={(value: "construction" | "hotel") => 
                          registerForm.setValue("userType", value)
                        }
                      >
                        <SelectTrigger data-testid="select-user-type">
                          <SelectValue placeholder="Select Account Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="construction">Construction Company Admin</SelectItem>
                          <SelectItem value="hotel">Hotel Partner Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      {registerForm.formState.errors.userType && (
                        <p className="text-sm text-destructive mt-1">
                          {registerForm.formState.errors.userType.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="register-companyName">
                        {registerForm.watch("userType") === "construction" ? "Company Name" : "Hotel Name"}
                      </Label>
                      <Input
                        id="register-companyName"
                        placeholder={registerForm.watch("userType") === "construction" ? "ABC Construction Co." : "Paradise Hotel"}
                        data-testid="input-company-name"
                        {...registerForm.register("companyName")}
                      />
                      {registerForm.formState.errors.companyName && (
                        <p className="text-sm text-destructive mt-1">
                          {registerForm.formState.errors.companyName.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="register-email">Email Address</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="admin@company.com"
                        data-testid="input-register-email"
                        {...registerForm.register("email")}
                      />
                      {registerForm.formState.errors.email && (
                        <p className="text-sm text-destructive mt-1">
                          {registerForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="register-password">Password</Label>
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="••••••••"
                        data-testid="input-register-password"
                        {...registerForm.register("password")}
                      />
                      {registerForm.formState.errors.password && (
                        <p className="text-sm text-destructive mt-1">
                          {registerForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="register-confirmPassword">Confirm Password</Label>
                      <Input
                        id="register-confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        data-testid="input-confirm-password"
                        {...registerForm.register("confirmPassword")}
                      />
                      {registerForm.formState.errors.confirmPassword && (
                        <p className="text-sm text-destructive mt-1">
                          {registerForm.formState.errors.confirmPassword.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="register-contactInfo">Contact Information (Optional)</Label>
                      <Input
                        id="register-contactInfo"
                        placeholder="Phone number, additional contact details"
                        data-testid="input-contact-info"
                        {...registerForm.register("contactInfo")}
                      />
                    </div>
                    
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={registerMutation.isPending}
                      data-testid="button-register"
                    >
                      {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
