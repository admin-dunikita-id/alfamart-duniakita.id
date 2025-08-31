import React from "react";

export const Card = ({ children, className = "" }) => (
    <div className={`rounded-xl border bg-white shadow ${className}`}>
        {children}
    </div>
);

export const CardHeader = ({ children, className = "" }) => (
    <div className={`border-b px-4 py-2 ${className}`}>{children}</div>
);

export const CardTitle = ({ children, className = "" }) => (
    <h2 className={`text-xl font-semibold ${className}`}>{children}</h2>
);

export const CardContent = ({ children, className = "" }) => (
    <div className={`p-4 ${className}`}>{children}</div>
);
