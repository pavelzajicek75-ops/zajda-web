// API Routes for R2 integration
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/', '');
    const segments = path.split('/').filter(Boolean);
    
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }
    
    try {
        // ===== CITÁTY =====
        if (segments[0] === 'quotes') {
            const bucket = env.SECTIONS_BUCKET;
            
            if (request.method === 'GET') {
                if (segments[1]) {
                    // Get single quote
                    const obj = await bucket.get(`quotes/${segments[1]}.json`);
                    if (!obj) return new Response('Not found', { status: 404, headers: corsHeaders });
                    return new Response(obj.body, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }
                // List all quotes
                const list = await bucket.list({ prefix: 'quotes/' });
                const quotes = [];
                for (const item of list.objects || []) {
                    const obj = await bucket.get(item.key);
                    if (obj) quotes.push(await obj.json());
                }
                return new Response(JSON.stringify(quotes), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            
            if (request.method === 'POST') {
                const data = await request.json();
                const id = data.id || crypto.randomUUID();
                data.id = id;
                await bucket.put(`quotes/${id}.json`, JSON.stringify(data));
                return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            
            if (request.method === 'PUT' && segments[1]) {
                const data = await request.json();
                data.id = segments[1];
                await bucket.put(`quotes/${segments[1]}.json`, JSON.stringify(data));
                return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            
            if (request.method === 'DELETE' && segments[1]) {
                await bucket.delete(`quotes/${segments[1]}.json`);
                return new Response('OK', { headers: corsHeaders });
            }
        }
        
        // ===== ČLÁNKY =====
        if (segments[0] === 'articles') {
            const bucket = env.ARTICLES_BUCKET;
            
            if (request.method === 'GET') {
                if (segments[1]) {
                    const obj = await bucket.get(`articles/${segments[1]}.json`);
                    if (!obj) return new Response('Not found', { status: 404, headers: corsHeaders });
                    return new Response(obj.body, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }
                const list = await bucket.list({ prefix: 'articles/' });
                const articles = [];
                for (const item of list.objects || []) {
                    const obj = await bucket.get(item.key);
                    if (obj) articles.push(await obj.json());
                }
                return new Response(JSON.stringify(articles), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            
            if (request.method === 'POST') {
                const data = await request.json();
                const id = data.id || crypto.randomUUID();
                data.id = id;
                await bucket.put(`articles/${id}.json`, JSON.stringify(data));
                return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            
            if (request.method === 'PUT' && segments[1]) {
                const data = await request.json();
                data.id = segments[1];
                await bucket.put(`articles/${segments[1]}.json`, JSON.stringify(data));
                return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            
            if (request.method === 'DELETE' && segments[1]) {
                await bucket.delete(`articles/${segments[1]}.json`);
                return new Response('OK', { headers: corsHeaders });
            }
        }
        
        // ===== FOTKY =====
        if (segments[0] === 'photos') {
            const bucket = env.PHOTOS_BUCKET;
            
            if (request.method === 'GET') {
                if (segments[1]) {
                    const obj = await bucket.get(`photos/${segments[1]}.json`);
                    if (!obj) return new Response('Not found', { status: 404, headers: corsHeaders });
                    return new Response(obj.body, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }
                const list = await bucket.list({ prefix: 'photos/' });
                const photos = [];
                for (const item of list.objects || []) {
                    if (!item.key.endsWith('.json')) continue;
                    const obj = await bucket.get(item.key);
                    if (obj) photos.push(await obj.json());
                }
                return new Response(JSON.stringify(photos), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            
            if (request.method === 'POST') {
                const formData = await request.formData();
                const file = formData.get('file');
                const id = crypto.randomUUID();
                const ext = file.name.split('.').pop();
                const key = `photos/${id}.${ext}`;
                
                // Upload image
                await bucket.put(key, file.stream(), {
                    httpMetadata: { contentType: file.type }
                });
                
                // Create metadata
                const metadata = {
                    id,
                    name: file.name,
                    url: `/api/photos/file/${id}.${ext}`,
                    thumbnail: `/api/photos/file/${id}_thumb.${ext}`,
                    width: 0,
                    height: 0,
                    createdAt: new Date().toISOString()
                };
                
                await bucket.put(`photos/${id}.json`, JSON.stringify(metadata));
                
                // Generate thumbnail (simplified - in production use Image Resizing)
                return new Response(JSON.stringify(metadata), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            
            if (request.method === 'PUT' && segments[1]) {
                const formData = await request.formData();
                const file = formData.get('file');
                const id = segments[1];
                const ext = file.name.split('.').pop();
                const key = `photos/${id}.${ext}`;
                
                await bucket.put(key, file.stream(), {
                    httpMetadata: { contentType: file.type }
                });
                
                const metaObj = await bucket.get(`photos/${id}.json`);
                const metadata = metaObj ? await metaObj.json() : { id, name: file.name };
                metadata.url = `/api/photos/file/${id}.${ext}`;
                metadata.updatedAt = new Date().toISOString();
                
                await bucket.put(`photos/${id}.json`, JSON.stringify(metadata));
                return new Response(JSON.stringify(metadata), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            
            if (request.method === 'DELETE' && segments[1]) {
                const id = segments[1];
                const list = await bucket.list({ prefix: `photos/${id}` });
                for (const item of list.objects || []) {
                    await bucket.delete(item.key);
                }
                return new Response('OK', { headers: corsHeaders });
            }
        }
        
        // Serve photo file
        if (segments[0] === 'photos' && segments[1] === 'file' && segments[2]) {
            const bucket = env.PHOTOS_BUCKET;
            const key = `photos/${segments[2]}`;
            const obj = await bucket.get(key);
            if (!obj) return new Response('Not found', { status: 404, headers: corsHeaders });
            
            return new Response(obj.body, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg',
                    'Cache-Control': 'public, max-age=31536000'
                }
            });
        }
        
        return new Response('Not found', { status: 404, headers: corsHeaders });
        
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
}
