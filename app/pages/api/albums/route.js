// pages/api/albums/route.js

import { NextResponse } from 'next/server';

export async function GET(req) {
    const { username, period } = req.query;
    return NextResponse.json(`{username: ${username}, period: ${period}})`, { status: 200 });
}