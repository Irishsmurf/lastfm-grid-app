// app/api/albums/route.js

import { NextResponse } from 'next/server';

export async function GET(req) {
    //const { username, period } = req.query;
    console.log(req.query)
    return NextResponse.json({message: "Hello World!"}, { status: 200 });
}